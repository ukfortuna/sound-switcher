# Gerçek Steam kabul testi

Durum: Henüz uygulanmadı. Hedef: Windows, Millennium v3.6.2.

1. `bun install` ve `bun run build` hatasız tamamlanmalı. Derleyicinin ürettiği dosya ve kurulumu kaydedilmeli.
2. `output_path = "auto"` ile yerel kurulumu derle; Millennium'da Sound Switcher'ı etkinleştir. Menü açılıyor mu?
3. Ayrı verilen message.wav dosyasını seç. Önizle, ses düzeyini azalt, Kaydet. Önizleme gerçek mesaj testi değildir.
4. Mesaj bildirimi sesi açık ve sohbet odağı başka yerdeyken ikinci hesaptan gerçek mesaj gönder. Yeni ses yalnızca bir kez çalmalı; eski ses üstüne binmemeli.
5. Çevrimiçi arkadaş ve grup bildirimi eski sesi kullanmalı.
6. Steam'i tamamen kapatıp aç. Seçilen dosya ve ses düzeyi korunmalı.
7. Diğer Steam hesabına geç. Eklenti kurulum genelinde aynı seçimi kullanmalı.
8. Varsayılana dön. İki saniye sonra yeni mesaj gönder. Eski ses dönmeli. Önbellek varsa Steam'i yeniden başlatıp tekrar kontrol et.
9. Eklentiyi devre dışı bırakıp Steam'i yeniden başlat. Varsayılan ses çalışmalı.
10. Desteklenen MP3/M4A/OGG ve WAV dosyalarını; 10 saniyeyi aşan, 5 MB'ı aşan ve bozuk dosyaları dene. Hatalı seçim son kaydedilen sesi bozmamalı.
11. Uzun dosyada Kaydet başarılı mı? RPC/config boyut sınırı hatası varsa gerçek üst sınırı ölçüp belgede ve kodda düşür.

Hata raporu: Steam sürümü, Millennium sürümü, işletim sistemi, dosya süresi/biçimi, önizleme ve gerçek mesaj sonucu, hata metni. Ses veya kişisel config göndermek gerekmez.

Gerçek mesaj değişmiyorsa önce hangi pencerenin sesi çaldığını, ses URL'sini ve kullanılan API'yi Steam geliştirici araçlarında tespit et. Dosya adını tahmin ederek geniş eşleşme ekleme.
