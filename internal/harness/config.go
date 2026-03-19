package harness

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// DefaultPath is the conventional location for a repo's harness config.
const DefaultPath = ".gastown/harness.yaml"

// Config holds tiered verification commands loaded from harness.yaml.
type Config struct {
	Tier0 []string `yaml:"tier0"`
	Tier1 []string `yaml:"tier1"`
}

// Tiers returns the tiers as a [][]string suitable for RunTiered.
func (c *Config) Tiers() [][]string {
	var tiers [][]string
	if len(c.Tier0) > 0 {
		tiers = append(tiers, c.Tier0)
	}
	if len(c.Tier1) > 0 {
		tiers = append(tiers, c.Tier1)
	}
	return tiers
}

// LoadConfig reads a harness.yaml from the given repo root.
// Returns nil, nil if the file does not exist.
func LoadConfig(repoRoot string) (*Config, error) {
	path := filepath.Join(repoRoot, DefaultPath)
	data, err := os.ReadFile(path) //nolint:gosec // G304: path from trusted repo root
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("reading harness config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parsing harness config %s: %w", path, err)
	}
	return &cfg, nil
}
