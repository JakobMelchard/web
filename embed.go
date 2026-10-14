// Package web embeds the built PWA shell from dist/.
package web

import (
	"bytes"
	"embed"
	"encoding/json"
	"regexp"
)

// FS holds dist/; serve it or copy files out of it.
//
//go:embed dist
var FS embed.FS

//go:embed dist/manifest.json
var template []byte

var slot = regexp.MustCompile(`"\{(\w+)\}"`)

// Manifest fills dist/manifest.json with the same bytes as manifest() in manifest.js.
// Keys: name, short_name, description, start_url, scope. A missing key becomes "".
func Manifest(o map[string]string) []byte {
	return slot.ReplaceAllFunc(template, func(m []byte) []byte {
		var b bytes.Buffer
		e := json.NewEncoder(&b)
		e.SetEscapeHTML(false)
		e.Encode(o[string(m[2:len(m)-2])])
		return bytes.TrimSpace(b.Bytes())
	})
}
