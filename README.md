# FreqHeal

Een web-app voor frequency healing, voor jezelf en voor anderen: binaurale beats, isochrone tonen, solfeggio- en chakrafrequenties, geluidslagen (regen, oceaan, wind, kampvuur, klankschaal, ruis), een ademgids, een sessielogboek en een Studio waarin je live je eigen frequenties draait.

Alles draait in de browser. Er is geen server en geen account nodig. Je gegevens (programma's, mensen, logboek) blijven op het apparaat waarop je de app gebruikt.

## Gebruiken

- **Online:** open de GitHub Pages-link van deze repository.
- **iPhone:** open de link in Safari en kies **Deel → Zet op beginscherm**. FreqHeal opent dan als app op volledig scherm en werkt ook offline.
- **Lokaal:** dubbelklik op `index.html`. Doorspelen bij een vergrendeld scherm en offline gebruik werken dan niet, omdat daar een service worker voor nodig is.

## Doorspelen bij een vergrendeld scherm

Op een telefoon wordt een sessie afgespeeld als gewoon audiobestand (WAV). `sw.js` berekent dat bestand stukje voor stukje terwijl het speelt. Daardoor:

- speelt het geluid door als het scherm vergrendeld is of als je een andere app opent
- staan afspelen, pauzeren en volgende stap op je vergrendelscherm
- dempt de stilschakelaar van de iPhone het geluid niet

Dit kun je instellen via ⚙ → *Doorspelen met vergrendeld scherm*. De Studio speelt altijd live via Web Audio, dus die stopt wel als je het scherm vergrendelt.

## Een sessie delen

Tik in de speler op **🔗 Delen** of bij een programma op **Delen**. Vul in voor wie de sessie is, je naam, de intentie en eventueel een persoonlijk bericht, en stuur de link via WhatsApp, Berichten of mail. Je kunt ook je geluidslagen, de ademgids en de duur meesturen.

De hele sessie zit in de link, achter het `#`-teken. Dat deel van de link wordt niet naar een server gestuurd, dus er wordt niets opgeslagen of geüpload. De ontvanger ziet een welkomstkaart, start de sessie met één tik en kan hem bewaren bij de eigen programma's.

## Bestanden

| Bestand | Wat |
|---|---|
| `index.html` | De hele app: interface, audio-engine en opslag |
| `sw.js` | Service worker voor offline gebruik en het afspelen op de achtergrond |
| `manifest.webmanifest`, `icons/` | Instellingen en iconen voor installatie als app |

## Back-up

Ga naar ⚙ → **Exporteren** voor een JSON-back-up van al je gegevens. Met **Importeren** zet je die terug, bijvoorbeeld op een ander apparaat.

---

FreqHeal is bedoeld voor ontspanning en welzijn. Het vervangt geen medisch advies of medische behandeling.
