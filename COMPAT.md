# COMPAT — hyperframes-local sunucusunu diger uygulamalara baglama

Tek komut: `nodeC:\dev\mcp\hyperframes-mcp\index.mjs`
Bu komut asagidaki uclude aynen boyle kullanilir.

## Claude Desktop
Konum: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hyperframes-local": {
      "command": "node",
      "args": [
        "C:\\dev\\mcp\\hyperframes-mcp\\index.mjs"
      ]
    }
  }
}
```

## Codex CLI
Konum: `%USERPROFILE%\.codex\config.toml` (satirlari ekleyin)

```toml
# Codex CLI: %USERPROFILE%\.codex\config.toml

[mcp_servers.hyperframes-local]
command = "node"
args = ["C:\dev\mcp\hyperframes-mcp\index.mjs"]

```

## ChatGPT (masaustu/web)
Yerel stdio sunuculari baglanti olarak dogrudan takilmaz; relay/Developer Mode gerekir.
Surum: `cmdc-stack/mcp/hostconfigs/CHATGPT.md`

> Merkezi kurulum/senkron icin: `cmdc-stack` deposu (`scripts/install.ps1`) tumunu
> tek manifestten kaydeder (Hermes / CommandCode dahil).
