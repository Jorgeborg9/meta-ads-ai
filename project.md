# Meta Ads AI Analyst

## Produktnavn
Meta Ads AI Analyst (arbeidsnavn)

## Kort produktbeskrivelse
Meta Ads AI Analyst er en webplattform som samler inn, analyserer og visualiserer resultatdata fra Meta Ads-kampanjer for små og mellomstore bedrifter. Plattformen automatiserer import av CSV-eksporter og bruker en lettvekts AI-modul til å generere rekommandasjoner basert på KPI-trender og avvik.

Løsningen gir en enkel dashboard-opplevelse med fokus på ROAS, CPA, CTR og antall salg, slik at markedsførere raskt kan identifisere vinnere og svakheter uten å bruke tid på manuelle rapporter i regneark eller notatverktøy.

## Målgruppe
- SMB-er (e-handel, tjenestebedrifter og byråer) som kjører Meta Ads men mangler tid/kompetanse til avansert analyse
- Markedsførere og growth managers som trenger rask status på kampanjer og lett forståelige anbefalinger

## Problem / pain points
- Tidskrevende manuelt arbeid med CSV-eksporter fra Ads Manager
- Spredt rapportering i Google Sheets og Notion gir lite konsistente tall
- Vanskelig å få rask oversikt over vinnere og tapere i kampanjer og ad sets
- Rapportering til ledelse eller kunder tar lang tid og krever mye manuelt arbeid
- Lite hjelp til å tolke data; mangler konkrete anbefalinger basert på KPI-avvik

## Mål / suksesskriterier for MVP
- Opplasting og parsing av minst én standard Meta Ads-CSV uten feil
- Dashboard som viser ROAS, CPA, CTR og antall salg per kampanje/ad set
- AI-modul genererer minst tre konkrete anbefalinger per datasett
- Første brukere skal kunne logge inn, laste opp data og få anbefalinger på under fem minutter
- Minst 5 pilot-SMB-er rapporterer at produktet sparer dem >2 timer rapportering per uke

## Scope for MVP
**In scope**
- CSV-upload fra brukerens maskin
- Parsing og lagring av Meta Ads-kampanjedata
- Standard KPI-beregninger (ROAS, CPA, CTR, antall salg)
- Enkel dashboard-side med tabeller + key metrics
- AI-genererte anbefalinger basert på enkle regler + LLM-prompts
- Basal autentisering (e-post + passord) og brukerhåndtering

**Out of scope**
- Direkte API-integrasjon mot Meta Ads (planlagt senere)
- Kompleks tilgangsstyring/rollestyring utover enkeltbrukere
- Automatiserte rapporter på e-post eller PDF
- Egne mobilapper
- Integrasjoner med andre annonseplattformer i første versjon

## Brukerhistorier
1. Som digital markedsfører vil jeg laste opp en Meta Ads-CSV for å se KPI-oversikten uten å åpne regneark.
2. Som SMB-eier vil jeg logge inn og få et enkelt dashboard som viser ROAS og antall salg per kampanje, slik at jeg kan ta raske beslutninger.
3. Som growth manager vil jeg se en liste over hvilke kampanjer som underpresterer på CPA, slik at jeg vet hvor jeg bør kutte budsjett.
4. Som byråkonsulent vil jeg få AI-genererte anbefalinger basert på nylige avvik, slik at jeg kan rapportere tiltak til kunder.
5. Som teammedlem vil jeg kunne laste ned et enkelt sammendrag (CSV/tekst) av anbefalingene for å lime inn i interne rapporter.

## Kjernefunksjoner i MVP
- CSV-upload med validering av format og datoperiode
- Parsing-pipeline som mapper kolonner til interne modeller
- KPI-visning for ROAS, CPA, CTR og antall salg med trendindikatorer
- AI-anbefalinger (tekstlig liste) basert på KPI-avvik
- Enkel dashboard-side med kortoversikt og tabellvisning
- Basisinnlogging og brukeradministrasjon med sesjonshåndtering

## Teknisk oversikt
- **Frontend:** React-baserte komponenter med TypeScript, routing for innlogging og dashboard, enklere state management.
- **Backend:** Node.js/Express API som håndterer autentisering, filopplastinger, parsing og KPI-beregninger.
- **Database:** Postgres for brukere, opplastede datasett og KPI-resultater; S3-lignende blob for rå CSV.
- **AI-modul:** Liten tjeneste som bruker forhåndstrent LLM via prompt + regler for anbefalinger.
- **Hosting:** Container-basert deploy (f.eks. Render/Heroku/Vercel for frontend + Railway/Fly.io for backend) med CI/CD senere.

## Risikoer og antakelser
- Antakelse om at standard Meta Ads-CSV holder konsistent struktur; risiko for variasjoner per språk/eksport.
- Avhengighet til tredjeparts LLM-API kan gi kostnads- eller latency-utfordringer.
- SMB-er kan ha lav datadisiplin; risiko for behov for mer avansert ETL tidlig.
- Sikker håndtering av brukerfiler og persondata må sikres; risiko for regulatoriske krav.
- Behov for tydelig differensiering vs. eksisterende rapporteringsverktøy.
