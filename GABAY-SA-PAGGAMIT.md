# CORVIA — Gabay sa Paggamit

Ang gabay na ito ay para sa kasalukuyang browser-based na CORVIA prototype. Iba-iba ang makikitang module depende sa role na pinili sa account.

> **Mahalagang paalala:** Prototype lamang ang CORVIA. Hindi ito konektado sa ospital, doktor, emergency services, o tunay na patient records. Gumamit lamang ng kathang-isip na impormasyon. Huwag gamitin ang mga alerto, vitals, gamot, o iba pang output nito para sa aktuwal na pangangalaga.

## 1. Pagbukas ng website

1. Buksan ang CORVIA website link sa isang modernong browser.
2. Hintaying matapos ang welcome animation, o piliin ang **Skip intro**.
3. Makikita sa landing page ang maikling pagpapakilala at account access panel.

Kung nasa GitHub Pages ang website, maaaring buksan ito bilang static site. Kailangang maisama sa repository ang `index.html`, `style.css`, `app.js`, `config.js`, `manifest.json`, at ang `assets` folder. Kahit online ang website, sa browser ng bawat user pa rin iniimbak ang account at station data.

## 2. Gumawa ng account

1. Piliin ang **Sign up**.
2. Ilagay ang buong pangalan, natatanging Staff / User ID, at password na may hindi bababa sa 8 character.
3. Piliin ang role:
   - **Doctor**
   - **Nurse**
   - **Health Worker** — pumili rin ng nakatalagang department workstation.
   - **Patient**
4. Piliin ang **Create station account**.
5. Dadalhin ka sa **Log in** tab at ilalagay doon ang iyong ID at role. Ilagay ang password at piliin ang **Open my workspace**.

Kung may gumagamit na ng ID, pumili ng ibang ID. Para sa Health Worker, kailangang tumugma ang department sa napili noong nag-sign up.

## 3. Mag-log in at mag-logout

1. Sa **Log in**, piliin ang role na ginamit sa pag-sign up.
2. Para sa Health Worker, piliin din ang tamang department workstation.
3. Ilagay ang Staff / User ID at password.
4. Piliin ang **Open my workspace**.
5. Para umalis sa account, piliin ang **Log out** sa header o **Return to gateway** sa ibaba ng workspace.

Ang **Show / Hide** button sa tabi ng password ay nagpapakita o nagtatago ng kasalukuyang password habang inilalagay ito.

## 4. Mga workspace

### Doctor

- Tingnan ang bilang ng admissions, telemetry alerts, at pending laboratory orders.
- Magtala ng admission at pumili ng ward, bed, at nurse na tatanggap ng intake alert.
- Magtala ng prescription at iskedyul ng dose.
- Magpadala ng laboratory request.
- Magtakda ng nursing care task o ward-round reminder.
- May Code Red station banner para sa prototype; **hindi ito nagpapadala ng emergency alert sa totoong ospital**.

### Nurse

- Tingnan at i-acknowledge ang bagong admission na nakatalaga sa nurse o hindi pa nakatalaga.
- Itala ang vital signs at tingnan ang mga reading na lumabas sa configured demo thresholds.
- Tingnan ang patient calls at piliin ang **Acknowledge call**.
- Tingnan ang medication schedule, due reminders, at piliin ang **Record dose** matapos suriin ang impormasyon. May confirmation bago mairekord ang dose.
- Tingnan at kumpletuhin ang naka-iskedyul na care tasks.
- Tanggapin at i-acknowledge ang mga pending handover.
- Hanapin ang records sa **Patient census & record search** gamit ang pangalan, MRN, diagnosis, ward o bed, at mga filter ng ward, status, department, at admission date.
- Buksan ang patient record para makita ang kaugnay na history at audit-style entries.

### Health Worker

Sa pag-sign up at pag-log in, piliin ang tamang workstation. May 11 department module:

1. ER Triage Specialist
2. ICU Telemetry Specialist
3. Laboratory Technician
4. Pharmacist / Dispenser
5. Internal Medicine Ward Staff
6. OPD Consultation Staff
7. Surgery Ward Staff
8. Billing & Subsidy Specialist
9. Pathology Staff
10. Pediatric Ward Staff
11. DR / OR Staff

Sundin ang label at helper text sa bawat form. Halimbawa, maaaring magtala ng triage, telemetry, laboratory result, SOAP note o handover, outpatient queue, post-operative note, billing arithmetic, pathology entry, pediatric calculation, o operating-room checklist depende sa napiling workstation.

### Patient

- Piliin ang **Patient** sa role at gamitin ang account ID na kapareho ng MRN na inilagay sa station admission para maitugma sa record.
- Kung may tugmang admission, makikita ang station assignment at care-team details.
- Maaaring magpadala ng nurse assistance request sa nurse console ng kasalukuyang browser station.
- Hindi ito emergency service. Para sa agarang panganib, sundin ang aktuwal na emergency procedure ng pasilidad.

## 5. Paano nasasave ang impormasyon

- Kapag matagumpay na nagawa ang account, sine-save ito sa local storage ng browser.
- Kapag matagumpay na naisumite ang isang station form o nakumpleto ang isang action, sine-save ang kaugnay na record sa browser na iyon.
- Ang password ay sine-save bilang salted PBKDF2 hash, hindi bilang nababasang plaintext.
- Mananatili ang data sa parehong browser profile matapos mag-refresh o muling buksan ang site, maliban kung mabura ang site data o browser storage.
- Ang pag-log out ay hindi nagtatanggal ng account o records.

### Mga limitasyon ng pag-save

- Hindi awtomatikong lumilipat o nagsi-sync ang account at records sa ibang device, browser profile, o user.
- Maaaring mag-update ang ibang CORVIA tab sa parehong browser/origin, pero hindi ito shared server database.
- Kapag gumamit ng private/incognito window o nag-clear ng browser/site data, maaaring mawala ang naka-save na impormasyon.
- Walang kasalukuyang server backup o data recovery kung mawala o masira ang local browser storage.

## 6. Status, alerts, at oras

- Ang oras at shift label ay gumagamit ng lokal na oras ng device.
- Ang telemetry status ay batay sa mga demonstration threshold sa `config.js`; hindi ito kapalit ng clinical judgment o facility protocol.
- Ang due medication at care-task reminders ay prototype reminders lamang at maaaring hindi tumakbo kapag nakasara ang website.
- Ang “Online” at ward synchronization label ay hindi nangangahulugang may koneksyon sa hospital server.

## 7. Seguridad at privacy

Ang role selection ay naghihiwalay ng mga screen sa prototype, ngunit **hindi ito katumbas ng tunay na server-side access control**. Ang local storage ay makikita at mababago ng taong may access sa browser profile. Ang history/audit entries ay hindi immutable o tamper-proof.

Huwag maglagay ng tunay na pangalan, MRN, diagnosis, vitals, prescription, o iba pang sensitibong impormasyon. Bago gamitin sa tunay na pangangalaga, kailangan ng backend, identity/access management, encrypted transport and storage, backup, monitoring, privacy/security review, at clinical validation.
