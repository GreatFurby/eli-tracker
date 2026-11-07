# Eli Tracker 2.4

Kelly gebruikt **Beheer** om voeding, pampers, temperatuur, gewicht en slaap te registreren of te corrigeren. Opslaan gebeurt onmiddellijk in de lokale IndexedDB-database. De app verstuurt de wijzigingen daarna naar Google Sheets. Ruben gebruikt **Kijkversie** met een eigen toegangscode en ziet wanneer de gegevens voor het laatst zijn opgehaald. Beide versies kunnen na de eerste installatie offline openen.

## 1. Begin met een proefkopie

1. Open het bestaande Google-spreadsheet en maak via **Bestand → Een kopie maken** een volledige kopie. Noteer hoeveel ingevulde gegevensrijen er in **Formulierreacties 1** en **Slaap** staan. Tel de koprij en lege rijen niet mee. Kies ook enkele oude en recente metingen en een slaapperiode waarvan je de tijden kunt vergelijken.
2. Maak voor de proef een apart Apps Script-project en gebruik de ID van de **kopie**. Volg stap 2 in dit document voor dat project. Gebruik een apart Chrome-profiel of de lokale preview voor de proef, zodat de koppeling van de proef en die van Kelly gescheiden blijven.
3. Voor een proef op de pc pak je de ZIP uit en open je een terminal in die map. Gebruik Node.js 20.19 of hoger en voer dit uit.

   ```sh
   npm ci
   npm run build
   npm run preview
   ```

   Open `http://localhost:4173/eli-tracker/?mode=controller` met de proeflink en proefcode. Controleer de aantallen en voorbeeldwaarden, voeg een testregistratie toe en probeer die offline te bewerken en te verwijderen. Open daarna de kijkversie met de kijkcode van de proef.

## 2. Google Apps Script en Sheets

Doe de definitieve migratie wanneer er even geen registraties worden toegevoegd. Maak vlak daarvoor een nieuwe volledige kopie van het live spreadsheet en bewaar ook de oude Apps Script-code. Pauzeer eventuele gekoppelde formulierinzendingen voor deze twee tabbladen.

1. Open **Extensies → Apps Script** vanuit het live spreadsheet. Plak de volledige inhoud van het aparte bestand **EliTracker_Backend_v2.4.gs** in plaats van de oude trackerbackend. Zorg dat het project één versie van `doGet` en `doPost` bevat.
2. Voeg via **Services → +** de **Google Sheets API** toe. Het identificatielabel is `Sheets`, versie `v4`. Als het script aan een standaard Google Cloud-project gekoppeld is, schakel je de Sheets API daar ook in. [Google Sheets-service voor Apps Script](https://developers.google.com/apps-script/advanced/sheets)
3. Open **Projectinstellingen → Scripteigenschappen**. Voeg `ELI_SPREADSHEET_ID` toe. Neem de ID uit de URL van het beoogde spreadsheet, tussen `/d/` en `/edit`.
4. Selecteer in de Apps Script-editor `createEliV24Codes` en klik **Uitvoeren**. Geef toestemming als Google daarom vraagt. De functie maakt twee scripteigenschappen aan. Geef `ELI_CONTROLLER_CODE` alleen aan Kelly. Gebruik `ELI_VIEWER_CODE` voor Ruben. Bewaar beide codes privé.
5. Voer `migrateEliV24` uit. Vergelijk `records` en `activeRecords` uit het uitvoeringslogboek met je telling. `addedIds` is het aantal nieuw toegekende ID’s. Een tweede uitvoering levert bij gelijkblijvende gegevens nul nieuwe ID’s op. Los een melding over een tabblad, kolom of rij op in de proefkopie voordat je live verdergaat.
6. Ga naar **Implementeren → Implementaties beheren**. Kies de bestaande web-app, klik op het potlood en selecteer **Nieuwe versie**. Stel **Uitvoeren als** in op **Mij** en **Wie heeft toegang** op **Iedereen**. De web-app controleert zelf de privétoegangscode. Kopieer de bestaande URL die eindigt op `/exec`. Archiveer eventuele andere actieve v2.3-implementaties van de tracker, zodat hun oude API niet meer kan schrijven. [Apps Script-web-apps](https://developers.google.com/apps-script/guides/web)

### Kolommen die de migratie toevoegt

| Tabblad | Bestaande kolommen | Nieuwe kolommen |
| --- | --- | --- |
| Formulierreacties 1 | A–L. `Temperatuur (°C)` staat in L. | M–Q |
| Slaap | A–D. `ID`, `Starttijd`, `Eindtijd`, `Opmerkingen`. | E–I |

De vijf nieuwe kolommen heten **Eli ID**, **Eli revisie**, **Eli aangemaakt**, **Eli gewijzigd** en **Eli verwijderd**. Gebruik lege kolommen op de aangegeven posities. De migratie weigert bezette metadatakolommen en schrijft alleen metadata. Bij oude rijen gebruikt ze de oorspronkelijke tijdstempel of slaapstart wanneer die als tijdstip beschikbaar is. Anders gebruikt ze het migratietijdstip.

Een verwijdering zet **Eli verwijderd** op `TRUE`. De rij blijft beschikbaar voor herstelonderzoek. De apps en nieuwe downloads slaan die rij over. Bij nieuwe of gewijzigde slaapcellen wordt de tijd met tijdzone opgeslagen. De app toont de lokale tijd. Voer nieuwe registraties en correcties na de overstap via **Beheer** in. Rechtstreekse wijzigingen in bestaande Sheet-cellen kunnen zichtbaar worden in de kijkversie en bij herstel. Kelly’s actieve lokale database ontvangt zulke wijzigingen nooit.

## 3. GitHub Pages

1. Pak **Eli-Tracker-2.4.zip** uit. Zet de inhoud in de **hoofdmap** van de bestaande `eli-tracker`-repository op `main`. Neem `src/`, `public/`, `scripts/`, `tests/`, `.github/workflows/deploy.yml` en de losse bestanden op hoofdniveau mee. Het aparte `.gs`-bestand hoort in Apps Script. Verwijder de oude `EliTracker_Backend_v2.3.gs` uit de huidige repository als die daar nog staat.
2. Commit en kijk onder **Actions** naar **Deploy Eli Tracker to GitHub Pages**. De workflow installeert de vastgelegde npm-versies, draait de typecontrole en tests, bouwt de app en publiceert `dist/`. De Pages-bron in **Settings → Pages** is **GitHub Actions**. Gebruik je bestaande URL met `/eli-tracker/` als basis.

## 4. Telefoons instellen

**Kelly**

1. Open de bestaande Pages-URL online in Chrome op Kelly’s telefoon en voeg `?mode=controller` toe na de laatste slash.
2. Vul de Apps Script-link en Kelly’s beheercode in. Tik **Downloaden uit Google Sheets**. Vergelijk de aantallen en voorbeelden met het spreadsheet. Tik dan **Gegevens bevestigen en activeren**. De app kan één beheerinstallatie tegelijk koppelen.
3. Controleer **Vandaag** en **Historiek**. Installeer via het Chrome-menu met **App installeren** of **Toevoegen aan startscherm**. Open de nieuwe **Beheer**-snelkoppeling één keer online en test daarna in vliegtuigmodus of de app opnieuw opent. Blijf dezelfde browser en hetzelfde profiel gebruiken.
4. Tik op een registratie in **Vandaag** of **Historiek** om te bewerken of te verwijderen. De slaaptegel op **Vandaag** opent de bestaande start- en stopknoppen. Een slaapperiode in de tijdlijn opent de bewerkmodus.

**Ruben**

1. Open dezelfde Pages-URL met `?mode=viewer`. Vul de Apps Script-link en Rubens kijkcode in en tik **Downloaden uit Google Sheets**.
2. **Laatst vernieuwd** toont wanneer de laatste download is gelukt. De kijkversie ververst bij openen, bij terugkeer naar de app en ongeveer elke minuut zolang die actief is. Met de knop bovenaan kun je ook direct vernieuwen. Offline blijven de eerder opgehaalde gegevens beschikbaar.

## 5. Herstel en terugval

- **Verbinding weg.** Registraties en de wachtrij blijven op Kelly’s telefoon. Open de app met verbinding en wacht op **Alles gesynchroniseerd**. De app probeert het opnieuw zodra die opent, weer verbinding ziet of terug actief wordt. De synchronisatie loopt terwijl de app open is.
- **Afgebroken eerste koppeling.** Kies **Eerdere koppeling voltooien** als die knop verschijnt. Als de gegevens ondertussen veranderden, download en controleer ze opnieuw.
- **Telefoon vervangen of browserdata verloren.** Laat het oude toestel eerst alle wijzigingen synchroniseren als het nog beschikbaar is. Maak eventueel via het tandwiel een **Lokale back-up**. Voer daarna in Apps Script `releaseEliV24Controller` uit en doorloop stap 4 op de nieuwe installatie. Is de oude telefoon zoek, verwijder dan ook `ELI_CONTROLLER_CODE` uit de scripteigenschappen en voer `createEliV24Codes` opnieuw uit voor een nieuwe beheercode.
- **Wijzigingen die nog wachtten.** Google Sheets bevat alleen de wijzigingen die de server heeft verwerkt. Een reset kan de lokale wachtrij wissen. De optionele JSON-back-up bevat de lokale gegevens en wachtrij, zonder toegangscodes. Bewaar die buiten de telefoon. Gebruik het bestand na herstel om ontbrekende wijzigingen handmatig te vergelijken en opnieuw in te voeren.
- **Terugval na een probleem met de migratie.** Pauzeer invoer en bewaar een kopie van de actuele Sheets plus een lokale back-up van Kelly. De kopie van vóór de migratie is het vertrekpunt voor v2.3. Als v2.4 al wijzigingen heeft verwerkt, vergelijk en verwerk die eerst, inclusief rijen met **Eli verwijderd**. De oude v2.3-backend leest die verwijdermarkering niet. Gebruik de oude app en backend alleen tegen een gecontroleerde, herstelde dataset.

## Techniek en tests

De beheer- en kijkversie hebben elk een eigen IndexedDB-database. De beheerapp schrijft elke wijziging en de bijbehorende wachtrijbewerking in één transactie. Apps Script controleert de rol, gekoppelde installatie en revisie. Een batch werkt de cellen en revisies samen bij via de Sheets API, zodat een herhaald verzoek dezelfde wijziging niet opnieuw uitvoert. [Atomaire Sheets-batches](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)

```sh
npm ci
npm run lint
npm test
npm run build
```

De backendtests gebruiken de aparte `.gs` met een nagebootste Apps Script- en Sheets-omgeving. Plaats het backendbestand naast de projectmap of zet `ELI_BACKEND_PATH` naar het bestand voordat je `npm run test:backend` uitvoert. Voor de browsertest kun je aanvullend `npm install --no-save playwright` en `npx playwright install chromium` uitvoeren en daarna `npm run test:browser`. De browsertest gebruikt de productiebuild en dezelfde nagebootste backend.

### Gecontroleerd voor deze release

| Controle | Resultaat |
| --- | --- |
| Typecontrole en productiebuild | Geslaagd met Node.js 20 |
| Lokale database, API-protocol en bestaande slaapberekeningen | 10 geslaagde tests |
| Apps Script-migratie, toegangscontrole, herhaalde batches en herstel na verloren antwoord | 6 geslaagde tests met nagebootste Sheets |
| Productiebuild in Chromium met mobiele viewport | Geslaagd. Eerste koppeling en herstel, offline heropenen in beide versies, offline aanmaken, bewerken en verwijderen, slaapstart en -stop, grafieken, synchronisatie na terugkeer van internet en wijzigingen in Sheets die de beheerdata ongemoeid laten. |

Voer de proefmigratie hierboven uit voor je overschakelt. De tests gebruikten voorbeeldgegevens en een nagebootste backend. De echte Google Sheets, Apps Script-implementatie, GitHub Pages en telefoons zijn tijdens de ontwikkeling niet gewijzigd of getest.
