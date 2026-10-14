package web

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

func TestFSMatchesSrc(t *testing.T) {
	src, err := os.ReadDir("src")
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range src {
		want, err := os.ReadFile("src/" + f.Name())
		if err != nil {
			t.Fatal(err)
		}
		got, err := FS.ReadFile("dist/" + f.Name())
		if err != nil || !bytes.Equal(got, want) {
			t.Errorf("dist/%s is missing or differs from src/; run npm run build", f.Name())
		}
	}
}

func TestManifestMatchesVectors(t *testing.T) {
	raw, err := os.ReadFile("test/vectors/manifest.json")
	if err != nil {
		t.Fatal(err)
	}
	var vectors []struct {
		Opts map[string]string
		Want string
	}
	if err := json.Unmarshal(raw, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, v := range vectors {
		if got := string(Manifest(v.Opts)); got != v.Want {
			t.Errorf("%s:\n%s\nwant:\n%s", v.Opts["name"], got, v.Want)
		}
	}
}
