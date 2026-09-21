BINARY := gustopos-print-agent
VERSION ?= 0.12.0
# Default server origin baked into the binary (pre-filled in the pairing page).
# Override per deployment, e.g. make linux API_BASE=https://pos.franksbar.it
API_BASE ?= https://test.franksbar.it
LDFLAGS := -s -w -X main.version=$(VERSION) -X main.defaultAPIBase=$(API_BASE)
# -H=windowsgui marks the PE subsystem as GUI so double-clicking the agent does
# not spawn a console window: it runs silently in the notification tray.
WINDOWS_LDFLAGS := $(LDFLAGS) -H=windowsgui

.PHONY: build linux windows darwin vet fmt clean install install-service publish-downloads

build:
	go build -trimpath -ldflags '$(LDFLAGS)' -o bin/$(BINARY) .

# Cross-compile static binaries (POS machines are usually Windows or Linux).
linux:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags '$(LDFLAGS)' -o bin/$(BINARY)-linux-amd64 .
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags '$(LDFLAGS)' -o bin/$(BINARY)-linux-arm64 .

windows:
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags '$(WINDOWS_LDFLAGS)' -o bin/$(BINARY)-windows-amd64.exe .

darwin:
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags '$(LDFLAGS)' -o bin/$(BINARY)-darwin-arm64 .
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags '$(LDFLAGS)' -o bin/$(BINARY)-darwin-amd64 .

vet:
	go vet ./...

fmt:
	gofmt -w *.go

clean:
	rm -rf bin

install: linux
	install -m 0755 bin/$(BINARY)-linux-amd64 /usr/local/bin/$(BINARY)

install-service: install
	install -m 0644 systemd/gustopos-print-agent.service /etc/systemd/system/
	systemctl daemon-reload
	systemctl enable gustopos-print-agent

# Copy release binaries + generate checksums/version.json/downloads page into
# apps/web/public/downloads (served at /downloads/). Requires binaries in bin/.
# Usage: make publish-downloads VERSION=0.8.0
publish-downloads:
	./scripts/publish-downloads.sh $(VERSION)
