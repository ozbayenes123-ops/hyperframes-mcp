# hyperframes-mcp

HyperFrames CLI'ini **MCP (Model Context Protocol)** üzerinden yapay zekâ
istemcilerine (Claude Desktop, Codex CLI, Hermes vb.) açan küçük bir stdio
sunucusudur. Sunucu, gelen MCP araç çağrılarını `hyperframes` CLI komutlarına
çevirir; böylece bir LLM sohbetinden video kompozisyonu projeleri
oluşturabilir, doğrulayabilir, önizleyebilir ve render edebilirsiniz.

- **Çalışma şekli:** `node index.mjs` — stdin/stdout üzerinden JSON-RPC (MCP stdio).
- **Bağımlılıklar:** `@modelcontextprotocol/sdk`, `hyperframes` CLI.
- **Varsayılan proje dizini:** `~/hyperframes` (ilk çalıştırmada otomatik oluşturulur).

## Araçlar (9 adet)

| Araç | Amaç | Önemli argümanlar |
| --- | --- | --- |
| `hyperframes_init` | Yeni bir HyperFrames video projesi (HTML kompozisyon) iskeleti oluşturur. | `name` (zorunlu), `cwd`, `example` (`blank`/`video`/`audio`) |
| `hyperframes_info` | CLI/sistem ortam bilgisini gösterir (Node, FFmpeg, sürümler). | — |
| `hyperframes_doctor` | Ortam tanılaması yapar (tarayıcı, ffmpeg, bağımlılıklar); render/önizleme hatalarında kullanın. | — |
| `hyperframes_lint` | Bir kompozisyon dosyasını/projeyi hatalara karşı denetler (data nitelikleri, klip, track). | `cwd`, `args` (ekstra CLI argümanları) |
| `hyperframes_check` | Proje yapısını ve kompozisyonlarını bütün olarak doğrular. | `cwd`, `args` |
| `hyperframes_render` | Kompozisyonu MP4'e render eder (headless Chrome + FFmpeg). Uzun sürer. | `cwd`, `args` (örn. `--out result.mp4`), `timeoutMs` (varsayılan 600000) |
| `hyperframes_preview` | Projenin önizleme sunucusunu arka planda başlatır ve localhost URL'sini döndürür. | `cwd` |
| `hyperframes_add` | Hazır katalog bloğunu projeye kurar (örn. `data-chart`, `flash-through-white`, `instagram-follow`). | `block` (zorunlu), `cwd`, `args` |
| `hyperframes_compositions` | Projedeki kompozisyonları listeler. | `cwd` |

## Kurulum

```bash
npm ci
```

## Çalıştırma

Sunucuyu doğrudan çalıştırın (stdio bekler, MCP istemcisi tarafından
başlatılmak üzere tasarlanmıştır):

```bash
node index.mjs
```

### Örnek MCP istemci yapılandırması

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hyperframes-local": {
      "command": "node",
      "args": ["C:\\dev\\mcp\\hyperframes-mcp\\index.mjs"]
    }
  }
}
```

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.hyperframes-local]
command = "node"
args = ["C:\\dev\\mcp\\hyperframes-mcp\\index.mjs"]
```

Linux/macOS'ta yolu kendi depo konumunuza göre (`/path/to/hyperframes-mcp/index.mjs`)
uyarlayın.

## Testler

### Hızlı smoke testi (CI için)

```bash
node scripts/smoke.mjs
```

Sunucuyu stdio üzerinden başlatır, el sıkışmayı yapar, `tools/list` ile
kayıtlı araçları listeler ve beklenen 9 aracın tamamının kayıtlı olduğunu
doğrular. Video render etmez, tarayıcı açmaz; bu yüzden hızlı ve deterministiktir.

### Manuel test (`test.mjs`) — ağır

```bash
node test.mjs
```

> **Dikkat:** `test.mjs` **gerçek bir video render eder** (≈300 kare) — headless
> Chromium ve FFmpeg gerektirir, yavaştır ve GPU'ya bağlıdır. Bu nedenle **CI'da
> çalıştırılmaz**; yalnızca elle, grafik/tarayıcı ortamı hazır olduğunda
> çalıştırın.

## CI

`.github/workflows/ci.yml` her `master`/`main` push'unda ve pull request'te
çalışır: `actions/setup-node@v4` ile Node 20, ardından `npm ci`,
`node --check index.mjs` ve `node scripts/smoke.mjs`. Ağır `test.mjs`
bilinçli olarak CI dışında tutulur.

## Lisans

MIT — bkz. [LICENSE](./LICENSE).
