# Hikâye Odası — Kaynak Proje

Damy için hazırlanan kişisel hikâye alanının ilk yayımlanmış sürümü.

## İçerik
- Koyu temalı, mobil uyumlu arayüz
- Karakter, lorebook ve profil oluşturma/düzenleme
- Ayrı hikâye defterleri, sahne kaydı ve hikâyeye özel bellek
- Hesaba bağlı Cloudflare D1 kayıtları
- Uygulama içinden JSON veri yedeği indirme

Bu sürüm yapay zekâya bağlı değildir; otomatik karakter yanıtı üretmez.
ZIP, kaynak kodu içerir. Canlı veritabanı ve sonradan kaydedilmiş sohbetler dahil değildir.
Canlı sitedeki verilerini ayrıca Ayarlar > Yedek indir ile alabilirsin. Bu sürümde yedek içe aktarma arayüzü yoktur.

## Bilgisayarda geliştirme
Bu bir HTML dosyası değildir; ZIP'i çıkardıktan sonra terminalle başlatılır.
Gerekenler: Node.js 22.13 veya üstü ve pnpm 11.25.0. Windows, macOS veya Linux kullanılabilir.

Proje klasöründe:

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm run build
```

İlk yerel veritabanını bir kez oluştur:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lame_carmella_unuscione.sql
```

Sonra geliştirme sunucusunu başlat:

```sh
pnpm run dev
```

Terminalde gösterilen adresi aç (varsayılan: http://localhost:5173).
Giriş bağlantısı yerel geliştirmede test kullanıcısını açar; gerçek ChatGPT hesabı oturumu değildir.
Yerel veriler bilgisayarındaki .wrangler/state dizinine yazılır; canlı sitedeki verilerle eşitlenmez.
Migrations komutunu aynı yerel veritabanına tekrar uygulama; tablo zaten varsa oluşturma hatası verir.

## Başka bir yerde yayımlama
Proje React/TypeScript, Vinext, Cloudflare Workers ve D1 kullanır.
Canlı sitedeki özel erişim ve ChatGPT oturumu Sites tarafından sağlanır.
Başka bir sunucuya taşıma için kimlik doğrulama, erişim kontrolü ve D1 bağlantısının ayrıca yapılandırılması gerekir.
Gelen kullanıcı kimlik başlıklarına yalnızca güvenilir bir kimlik doğrulama katmanının arkasında güvenilmelidir.
Yerel test oturumu gerçek üretim erişim kontrolünün yerine geçmez.
.openai/hosting.json mevcut sitenin kimliğini içerir; başka proje oluştururken bu kimlikle mevcut siteye yayımlama yapma.

## Önemli dosyalar
- app/page.tsx: Ekranlar ve etkileşimler
- app/globals.css: Görsel tasarım ve mobil düzen
- app/api/notebook/route.ts: Kayıt API'si
- app/chatgpt-auth.ts: Oturum yardımcıları
- db/schema.ts ve drizzle/: Veritabanı şeması ve migration
- package.json / pnpm-lock.yaml: Bağımlılıklar
- vite.config.ts ve worker/index.ts: Çalışma ortamı
- README.md: Altyapının ayrıntılı teknik rehberi

## Doğrulama ve sürüm
İlk yayında TypeScript kontrolü ve üretim derlemesi başarılıydı. Bu dışa aktarımda kaynak dosyalarının eşleşmesi ve ZIP bütünlüğü kontrol edildi; yeni bir bilgisayarda kurulum çalıştırılmadı.
node_modules, derleme çıktısı, Git geçmişi, oturum bilgileri ve gizli anahtarlar pakete dahil edilmedi.
Kaynak commit: e8374752ee62af5bf4669988d01552871ea221c8
