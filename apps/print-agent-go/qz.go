package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// QZClient talks to the local QZ Tray WebSocket server (default ws://localhost:8182).
//
// Wire protocol — QZ Tray 2.x (verified against qzind/tray PrintSocketClient.java,
// v2.2.6 and master):
//  1. ALL messages are TEXT JSON frames. QZ Tray 2.x has no binary-frame handler
//     (the endpoint only declares @OnWebSocketMessage(Session, Reader)), so the
//     old 1.x binary certificate/signature frames are silently ignored.
//  2. On connect, register the signing certificate with a JSON message:
//     {"certificate": "<PEM>", "uid": "..."} → QZ replies {"uid":..., "result":null}
//     (or a gateway dialog for first-time/unsaved certs).
//  3. Signed calls carry call/params/uid/timestamp/signature/signAlgorithm in ONE
//     JSON text message. The signature is RSA-SHA512 over the SHA-256 hex digest of
//     the JSON string containing ONLY {"call", "params", "timestamp"} — exactly what
//     qz-tray.js hashes and what QZ's validSignature()/isSignatureValid() verify.
type QZClient struct {
	mu       sync.Mutex
	writeMu  sync.Mutex // gorilla/websocket requires serialized writes (ping + print)
	conn     *websocket.Conn
	url      string
	certPEM  string
	signer   func(string) (string, error) // returns base64 RSA signature for a signable JSON payload
	pending  map[string]chan qzResult
	closed   bool
	stopPing chan struct{}
}

type qzResult struct {
	err error
}

func NewQZClient(url, certPEM string, signer func(string) (string, error)) *QZClient {
	return &QZClient{
		url:     url,
		certPEM: certPEM,
		signer:  signer,
		pending: map[string]chan qzResult{},
	}
}

// Connect dials QZ Tray, performs the certificate handshake and waits for the
// handshake ack. A 401-style "Connection blocked" error or a timeout (QZ is
// showing a gateway dialog for a not-yet-trusted cert) is returned so the caller
// can defer the job and retry later instead of failing it.
func (q *QZClient) Connect() error {
	q.mu.Lock()
	if q.conn != nil {
		q.mu.Unlock()
		return nil
	}
	q.mu.Unlock()

	// QZ Tray uses a self-signed cert for wss://. Skip verification only because
	// this is the local loopback socket. The cert still authenticates signed
	// messages, matching the Node agent's rejectUnauthorized:false behavior.
	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
		TLSClientConfig:  &tls.Config{InsecureSkipVerify: true},
	}
	conn, _, err := dialer.Dial(q.url, nil)
	if err != nil {
		return fmt.Errorf("QZ Tray unreachable at %s: %w", q.url, err)
	}

	q.mu.Lock()
	q.conn = conn
	q.closed = false
	q.stopPing = make(chan struct{})
	stop := q.stopPing
	q.mu.Unlock()
	go q.readLoop(conn)
	go q.pingLoop(conn, stop)

	// Certificate handshake (QZ 2.x): JSON text message, not binary.
	uid := newUID()
	ch := make(chan qzResult, 1)
	q.mu.Lock()
	q.pending[uid] = ch
	q.mu.Unlock()
	msg := fmt.Sprintf(`{"certificate":%s,"uid":%s}`, jsonString(q.certPEM), jsonString(uid))
	q.writeMu.Lock()
	writeErr := conn.WriteMessage(websocket.TextMessage, []byte(msg))
	q.writeMu.Unlock()
	if writeErr != nil {
		q.forget(uid)
		q.Close()
		return fmt.Errorf("send certificate to QZ Tray: %w", writeErr)
	}
	select {
	case res := <-ch:
		if res.err != nil {
			q.Close()
			return fmt.Errorf("certificate rejected by QZ Tray: %w", res.err)
		}
	case <-time.After(15 * time.Second):
		q.forget(uid)
		q.Close()
		return fmt.Errorf("QZ Tray did not acknowledge certificate within 15s (first-time allow dialog?)")
	}
	return nil
}

// Connected reports whether the underlying socket is currently open.
func (q *QZClient) Connected() bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.conn != nil && !q.closed
}

// Close terminates the connection, stops the keepalive ping and fails any
// pending jobs.
func (q *QZClient) Close() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.closed = true
	if q.stopPing != nil {
		close(q.stopPing)
		q.stopPing = nil
	}
	if q.conn != nil {
		_ = q.conn.Close()
		q.conn = nil
	}
	for uid, ch := range q.pending {
		ch <- qzResult{err: fmt.Errorf("QZ connection closed")}
		delete(q.pending, uid)
	}
}

// pingLoop keeps the socket alive (QZ Tray drops idle connections after ~5 min,
// and "ping" text messages are explicitly ignored by the server).
func (q *QZClient) pingLoop(conn *websocket.Conn, stop chan struct{}) {
	t := time.NewTicker(60 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
		}
		q.mu.Lock()
		closed := q.closed || q.conn != conn
		q.mu.Unlock()
		if closed {
			return
		}
		if err := func() error {
			q.writeMu.Lock()
			defer q.writeMu.Unlock()
			return conn.WriteMessage(websocket.TextMessage, []byte("ping"))
		}(); err != nil {
			return
		}
	}
}

func (q *QZClient) readLoop(conn *websocket.Conn) {
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			q.Close()
			return
		}
		var resp struct {
			UID string `json:"uid"`
			Err any    `json:"error"`
		}
		if json.Unmarshal(raw, &resp) != nil {
			continue // non-JSON frame — ignore
		}
		if resp.UID == "" {
			continue
		}
		q.mu.Lock()
		ch := q.pending[resp.UID]
		delete(q.pending, resp.UID)
		q.mu.Unlock()
		if ch == nil {
			continue
		}
		if resp.Err != nil {
			ch <- qzResult{err: fmt.Errorf("QZ Tray: %v", resp.Err)}
		} else {
			ch <- qzResult{}
		}
	}
}

// Print sends a raw ESC/POS job (base64 payload) to the named printer and blocks
// until QZ Tray acks (or a timeout). Uses the QZ 2.x object-form params and an
// embedded signature:
//
//	{"uid":..., "call":"print", "params":{"printer":{"name":...},"options":{},"data":[{"type":"raw","format":"base64","data":...}]},
//	 "timestamp":<ms>, "signature":"<base64>", "signAlgorithm":"SHA512"}
//
// The signature is computed over `{"call","params","timestamp"}` only (no uid),
// matching QZ Tray's validSignature()/isSignatureValid().
func (q *QZClient) Print(printerName, payloadB64 string, timeout time.Duration) error {
	q.mu.Lock()
	conn := q.conn
	q.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("QZ Tray not connected")
	}

	ts := time.Now().UnixMilli()
	uid := newUID()
	paramsJSON := fmt.Sprintf(`{"printer":{"name":%s},"options":{},"data":[{"type":"raw","format":"base64","data":%s}]}`,
		jsonString(printerName), jsonString(payloadB64))
	signContent := fmt.Sprintf(`{"call":"print","params":%s,"timestamp":%d}`, paramsJSON, ts)

	// Re-check the connection before the /api/sign round-trip so a dropped
	// socket doesn't waste a sign call.
	q.mu.Lock()
	conn = q.conn
	q.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("QZ Tray not connected")
	}

	sigB64, err := q.signer(signContent)
	if err != nil {
		return fmt.Errorf("sign job: %w", err)
	}
	sigB64 = strings.TrimSpace(sigB64)

	msg := fmt.Sprintf(`{"uid":%s,"call":"print","params":%s,"timestamp":%d,"signature":%s,"signAlgorithm":"SHA512"}`,
		jsonString(uid), paramsJSON, ts, jsonString(sigB64))

	ch := make(chan qzResult, 1)
	q.mu.Lock()
	if q.closed || q.conn == nil {
		q.mu.Unlock()
		return fmt.Errorf("QZ Tray not connected")
	}
	q.pending[uid] = ch
	conn = q.conn
	q.mu.Unlock()

	if err := func() error {
		q.writeMu.Lock()
		defer q.writeMu.Unlock()
		return conn.WriteMessage(websocket.TextMessage, []byte(msg))
	}(); err != nil {
		q.forget(uid)
		return fmt.Errorf("write request: %w", err)
	}

	select {
	case res := <-ch:
		return res.err
	case <-time.After(timeout):
		q.forget(uid)
		return fmt.Errorf("QZ Tray response timeout after %s", timeout)
	}
}

func (q *QZClient) forget(uid string) {
	q.mu.Lock()
	delete(q.pending, uid)
	q.mu.Unlock()
}

// newUID returns a unique request id echoed by QZ Tray in the response.
func newUID() string {
	return fmt.Sprintf("gzp_%d", time.Now().UnixNano())
}

// jsonString returns a JSON string literal for s (quoted + escaped), matching
// what qz-tray.js JSON.stringify and QZ's jettison serializer produce: HTML
// characters (<, >, &) are NOT escaped, so the signed bytes line up exactly.
func jsonString(s string) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(s); err != nil {
		return `""`
	}
	return strings.TrimSpace(buf.String())
}
