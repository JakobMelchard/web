package web

import (
	"encoding/json"
	"io/fs"
	"os"
	"testing"
)

func TestFSHasEveryDistFile(t *testing.T) {
	want := map[string]bool{}
	err := fs.WalkDir(os.DirFS("."), "dist", func(p string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			want[p] = true
		}
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	fs.WalkDir(FS, "dist", func(p string, d fs.DirEntry, err error) error {
		delete(want, p)
		return err
	})
	if len(want) > 0 {
		t.Fatalf("not embedded: %v", want)
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
