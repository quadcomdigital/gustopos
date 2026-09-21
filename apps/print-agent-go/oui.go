package main

import "strings"

// ouiVendor is a tiny, best-effort OUI → vendor map for the most common POS /
// receipt printer manufacturers. It intentionally stays small: an unknown MAC
// simply yields no vendor rather than a wrong guess.
var ouiVendors = map[string]string{
	"00:00:48": "Seiko Epson",
	"00:26:ab": "Seiko Epson",
	"00:80:77": "Brother",
	"00:1b:a9": "Brother",
	"00:11:62": "Star Micronics",
	"00:15:0e": "Star Micronics",
	"00:07:4d": "Zebra",
	"00:15:70": "Zebra",
	"00:0a:5a": "Bixolon",
	"00:1c:ab": "Bixolon",
}

// ouiVendor resolves the vendor for a (colon or dash separated) MAC address.
func ouiVendor(mac string) string {
	mac = strings.ToLower(strings.TrimSpace(mac))
	if len(mac) < 8 {
		return ""
	}
	prefix := mac[:8]
	if vendor, ok := ouiVendors[prefix]; ok {
		return vendor
	}
	return ""
}
