/**
 * Tests for src/lib/guide/lang.ts: which language a text is in, and how a
 * sentence is cut into the pieces each voice reads.
 *
 * Run: node --test "scripts/tests/*.test.ts"   (or npm run test:speech)
 * Node 24 will not take a bare folder ("node --test scripts/tests/" tries to
 * load the folder as a module); the quoted glob is expanded by Node itself.
 *
 * The first thing these guard is the rule the module is built around: an
 * English lesson never switches to a foreign voice by mistake (names,
 * loanwords, formulas, code, a two-word French quote). After that: every
 * script language, the Latin-script languages on realistic lesson sentences,
 * long notes, and mixed sentences.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DETECTABLE, detectLang, speechRuns } from "../../src/lib/guide/lang.ts";

// ── Lesson sentences, one list per Latin-script language ─────────────────────

const LATIN_LESSONS: Record<string, string[]> = {
  en: [
    "Photosynthesis is the process by which green plants use sunlight to make their own food.",
    "The French Revolution began in 1789 and changed the way people thought about power.",
    "To find the area of a triangle, multiply the base by the height and divide by two.",
    "Water boils at one hundred degrees Celsius when it is at sea level.",
  ],
  fr: [
    "La photosynthèse est le processus par lequel les plantes vertes utilisent la lumière du soleil pour fabriquer leur nourriture.",
    "La Révolution française a commencé en 1789 et a changé la façon dont les gens pensaient le pouvoir.",
    "Pour trouver l'aire d'un triangle, on multiplie la base par la hauteur et on divise par deux.",
    "L'eau bout à cent degrés Celsius au niveau de la mer, mais pas en altitude.",
  ],
  es: [
    "La fotosíntesis es el proceso por el cual las plantas verdes usan la luz del sol para fabricar su propio alimento.",
    "La Revolución francesa comenzó en 1789 y cambió la forma en que las personas pensaban sobre el poder.",
    "Para calcular el área de un triángulo, se multiplica la base por la altura y se divide entre dos.",
    "El agua hierve a cien grados Celsius cuando está al nivel del mar.",
  ],
  pt: [
    "A fotossíntese é o processo pelo qual as plantas verdes usam a luz do sol para produzir o seu próprio alimento.",
    "A Revolução Francesa começou em 1789 e mudou a forma como as pessoas pensavam sobre o poder.",
    "Para calcular a área de um triângulo, multiplica-se a base pela altura e divide-se o resultado por dois.",
    "A água ferve a cem graus Celsius quando está ao nível do mar.",
  ],
  it: [
    "La fotosintesi è il processo con cui le piante verdi usano la luce del sole per produrre il proprio nutrimento.",
    "La Rivoluzione francese iniziò nel 1789 e cambiò il modo in cui le persone pensavano al potere.",
    "Per trovare l'area di un triangolo si moltiplica la base per l'altezza e si divide per due.",
    "L'acqua bolle a cento gradi Celsius quando si trova al livello del mare.",
  ],
  de: [
    "Die Photosynthese ist der Vorgang, bei dem grüne Pflanzen das Sonnenlicht nutzen, um ihre eigene Nahrung herzustellen.",
    "Die Französische Revolution begann im Jahr 1789 und veränderte, wie die Menschen über Macht dachten.",
    "Um die Fläche eines Dreiecks zu berechnen, multipliziert man die Grundseite mit der Höhe und teilt durch zwei.",
    "Wasser kocht auf Meereshöhe bei hundert Grad Celsius, in den Bergen aber schon früher.",
  ],
  nl: [
    "Fotosynthese is het proces waarbij groene planten zonlicht gebruiken om hun eigen voedsel te maken.",
    "De Franse Revolutie begon in 1789 en veranderde de manier waarop mensen over macht dachten.",
    "Om de oppervlakte van een driehoek te berekenen, vermenigvuldig je de basis met de hoogte en deel je door twee.",
    "Water kookt op zeeniveau bij honderd graden Celsius, maar in de bergen al eerder.",
  ],
  af: [
    "Fotosintese is die proses waardeur groen plante sonlig gebruik om hul eie kos te maak.",
    "Die Franse Rewolusie het in 1789 begin en het die manier verander waarop mense oor mag gedink het.",
    "Om die oppervlakte van 'n driehoek te bereken, vermenigvuldig jy die basis met die hoogte en deel dit deur twee.",
    "Water kook by seevlak teen honderd grade Celsius, maar hoër op in die berge kook dit gouer.",
  ],
  sv: [
    "Fotosyntes är den process där gröna växter använder solljus för att tillverka sin egen näring.",
    "Franska revolutionen började år 1789 och förändrade hur människor tänkte om makt.",
    "För att räkna ut arean av en triangel multiplicerar man basen med höjden och delar med två.",
    "Vatten kokar vid hundra grader Celsius när det är vid havsnivån.",
  ],
  nb: [
    "Fotosyntese er prosessen der grønne planter bruker sollys til å lage sin egen næring.",
    "Den franske revolusjonen startet i 1789 og endret måten folk tenkte på makt.",
    "For å finne arealet av en trekant ganger man grunnlinjen med høyden og deler på to.",
    "Vann koker ved hundre grader celsius når det er ved havnivå, men ikke på toppen av et fjell.",
  ],
  da: [
    "Fotosyntese er den proces, hvor grønne planter bruger sollys til at lave deres egen føde.",
    "Den franske revolution begyndte i 1789 og ændrede den måde, folk tænkte på magt.",
    "For at finde arealet af en trekant ganger man grundlinjen med højden og dividerer med to.",
    "Vand koger ved hundrede grader celsius, når man er ved havets overflade, men ikke på toppen af et bjerg.",
  ],
  fi: [
    "Yhteyttäminen on prosessi, jossa vihreät kasvit käyttävät auringonvaloa oman ravintonsa valmistamiseen.",
    "Ranskan vallankumous alkoi vuonna 1789 ja muutti sitä, miten ihmiset ajattelivat vallasta.",
    "Kolmion pinta-ala on kanta kertaa korkeus jaettuna kahdella, ja se on helppo laskea.",
    "Vesi kiehuu sadassa asteessa, kun ollaan merenpinnan tasolla, mutta vuorilla jo aiemmin.",
  ],
  et: [
    "Fotosüntees on protsess, mille käigus rohelised taimed kasutavad päikesevalgust, et toota endale toitu.",
    "Prantsuse revolutsioon algas 1789. aastal ja muutis seda, kuidas inimesed võimust mõtlesid.",
    "Kolmnurga pindala leidmiseks korrutatakse alus kõrgusega ja jagatakse see kahega.",
    "Vesi keeb merepinna kõrgusel saja kraadi juures, kui rõhk on normaalne.",
  ],
  pl: [
    "Fotosynteza to proces, w którym zielone rośliny wykorzystują światło słoneczne do wytwarzania pokarmu.",
    "Rewolucja francuska rozpoczęła się w 1789 roku i zmieniła sposób, w jaki ludzie myśleli o władzy.",
    "Aby obliczyć pole trójkąta, mnożymy podstawę przez wysokość i dzielimy przez dwa.",
    "Woda wrze w temperaturze stu stopni Celsjusza, gdy jest na poziomie morza.",
  ],
  cs: [
    "Fotosyntéza je proces, při kterém zelené rostliny využívají sluneční světlo k výrobě vlastní potravy.",
    "Francouzská revoluce začala v roce 1789 a změnila způsob, jakým lidé přemýšleli o moci.",
    "Abychom vypočítali obsah trojúhelníku, vynásobíme základnu výškou a vydělíme dvěma.",
    "Voda se vaří při sto stupních Celsia, když je na úrovni hladiny moře.",
  ],
  sk: [
    "Fotosyntéza je proces, pri ktorom zelené rastliny využívajú slnečné svetlo na výrobu vlastnej potravy.",
    "Francúzska revolúcia sa začala v roku 1789 a zmenila spôsob, akým ľudia rozmýšľali o moci.",
    "Aby sme vypočítali obsah trojuholníka, vynásobíme základňu výškou a vydelíme dvoma.",
    "Voda vrie pri sto stupňoch Celzia, keď je na úrovni hladiny mora.",
  ],
  hr: [
    "Fotosinteza je proces u kojem zelene biljke koriste sunčevu svjetlost kako bi proizvele vlastitu hranu.",
    "Francuska revolucija počela je 1789. godine i promijenila je način na koji su ljudi razmišljali o vlasti.",
    "Da bismo izračunali površinu trokuta, pomnožimo osnovicu s visinom i podijelimo je s dva.",
    "Voda vrije na sto stupnjeva Celzija kada je na razini mora.",
  ],
  sl: [
    "Fotosinteza je proces, pri katerem zelene rastline uporabljajo sončno svetlobo za izdelavo lastne hrane.",
    "Francoska revolucija se je začela leta 1789 in je spremenila način, kako so ljudje razmišljali o oblasti.",
    "Da izračunamo ploščino trikotnika, pomnožimo osnovnico z višino in delimo z dve.",
    "Voda zavre pri sto stopinjah Celzija, ko je na morski gladini.",
  ],
  ro: [
    "Fotosinteza este procesul prin care plantele verzi folosesc lumina soarelui pentru a-și produce hrana.",
    "Revoluția franceză a început în 1789 și a schimbat felul în care oamenii se gândeau la putere.",
    "Pentru a afla aria unui triunghi, înmulțim baza cu înălțimea și împărțim rezultatul la doi.",
    "Apa fierbe la o sută de grade Celsius atunci când este la nivelul mării.",
  ],
  hu: [
    "A fotoszintézis az a folyamat, amelynek során a zöld növények a napfényt használják fel saját táplálékuk előállítására.",
    "A francia forradalom 1789-ben kezdődött, és megváltoztatta, hogyan gondolkodtak az emberek a hatalomról.",
    "A háromszög területét úgy számítjuk ki, hogy az alapot megszorozzuk a magassággal, majd elosztjuk kettővel.",
    "A víz tengerszinten száz Celsius-fokon forr, de a hegyekben már alacsonyabb hőmérsékleten.",
  ],
  tr: [
    "Fotosentez, yeşil bitkilerin kendi besinlerini üretmek için güneş ışığını kullandığı bir süreçtir.",
    "Fransız Devrimi 1789 yılında başladı ve insanların güç hakkında düşünme biçimini değiştirdi.",
    "Bir üçgenin alanını bulmak için taban ile yükseklik çarpılır ve sonuç ikiye bölünür.",
    "Su, deniz seviyesinde yüz santigrat derecede kaynar ama dağlarda daha düşük sıcaklıkta kaynar.",
  ],
  az: [
    "Fotosintez yaşıl bitkilərin günəş işığından istifadə edərək öz qidasını hazırladığı prosesdir.",
    "Fransız inqilabı 1789-cu ildə başladı və insanların hakimiyyət haqqında düşüncəsini dəyişdi.",
    "Üçbucağın sahəsini tapmaq üçün oturacaq hündürlüyə vurulur və nəticə ikiyə bölünür.",
    "Su dəniz səviyyəsində yüz dərəcədə qaynayır, lakin dağlarda daha tez qaynayır.",
  ],
  uz: [
    "Fotosintez yashil o'simliklar quyosh nuridan foydalanib o'z ozuqasini tayyorlaydigan jarayon hisoblanadi.",
    "Fransuz inqilobi 1789-yilda boshlandi va odamlarning hokimiyat haqidagi fikrini o'zgartirdi.",
    "Uchburchakning yuzini topish uchun asosni balandlikka ko'paytirib, natijani ikkiga bo'lish kerak.",
    "Suv dengiz sathida yuz gradusda qaynaydi va bu juda muhim hodisa hisoblanadi.",
  ],
  id: [
    "Fotosintesis adalah proses yang digunakan tumbuhan hijau untuk membuat makanannya sendiri dengan bantuan sinar matahari.",
    "Revolusi Prancis dimulai pada tahun 1789 dan mengubah cara orang berpikir tentang kekuasaan.",
    "Untuk menghitung luas segitiga, kalikan alas dengan tinggi lalu bagi hasilnya dengan dua.",
    "Air mendidih pada suhu seratus derajat Celsius di permukaan laut karena tekanan udara.",
  ],
  ms: [
    "Fotosintesis ialah proses yang digunakan oleh tumbuhan hijau untuk menghasilkan makanan sendiri daripada cahaya matahari.",
    "Revolusi Perancis bermula pada tahun 1789 dan ia telah mengubah cara manusia berfikir tentang kuasa kerana rakyat mahukan perubahan.",
    "Untuk mengira luas segi tiga, kita boleh mendarab tapak dengan tinggi dan kemudian membahagikan hasilnya dengan dua.",
    "Air mendidih pada suhu seratus darjah Celsius di paras laut kerana tekanan udara.",
  ],
  fil: [
    "Ang potosintesis ay ang proseso kung saan ginagamit ng mga halaman ang liwanag ng araw upang gumawa ng sariling pagkain.",
    "Nagsimula ang Rebolusyong Pranses noong 1789 at binago nito ang paraan ng pag-iisip ng mga tao tungkol sa kapangyarihan.",
    "Upang makuha ang lawak ng tatsulok, i-multiply ang base sa taas at hatiin ito sa dalawa.",
    "Kumukulo ang tubig sa isang daang digri Celsius kapag nasa antas ito ng dagat.",
  ],
  vi: [
    "Quang hợp là quá trình cây xanh sử dụng ánh sáng mặt trời để tự tạo ra chất dinh dưỡng.",
    "Cách mạng Pháp bắt đầu vào năm 1789 và đã thay đổi cách con người suy nghĩ về quyền lực.",
    "Để tính diện tích tam giác, ta nhân đáy với chiều cao rồi chia cho hai.",
    "Nước sôi ở một trăm độ C khi ở mực nước biển.",
  ],
  lt: [
    "Fotosintezė yra procesas, kurio metu žalieji augalai naudoja saulės šviesą savo maistui pasigaminti.",
    "Prancūzijos revoliucija prasidėjo 1789 metais ir pakeitė tai, kaip žmonės galvojo apie valdžią.",
    "Norėdami apskaičiuoti trikampio plotą, pagrindą padauginame iš aukštinės ir padaliname iš dviejų.",
    "Vanduo verda šimto laipsnių temperatūroje, kai yra jūros lygyje.",
  ],
  lv: [
    "Fotosintēze ir process, kurā zaļie augi izmanto saules gaismu, lai paši ražotu sev barību.",
    "Francijas revolūcija sākās 1789. gadā un mainīja to, kā cilvēki domāja par varu.",
    "Lai aprēķinātu trijstūra laukumu, pamatu reizina ar augstumu un rezultātu dala ar divi.",
    "Ūdens vārās simts grādu temperatūrā, kad tas ir jūras līmenī.",
  ],
  sq: [
    "Fotosinteza është procesi me të cilin bimët e gjelbra përdorin dritën e diellit për të prodhuar ushqimin e tyre.",
    "Revolucioni Francez filloi në vitin 1789 dhe ndryshoi mënyrën se si njerëzit mendonin për pushtetin.",
    "Për të gjetur sipërfaqen e një trekëndëshi, shumëzojmë bazën me lartësinë dhe e pjesëtojmë me dy.",
    "Uji vlon në njëqind gradë Celsius kur është në nivelin e detit.",
  ],
  is: [
    "Ljóstillífun er ferlið þar sem grænar plöntur nota sólarljós til að búa til eigin fæðu.",
    "Franska byltingin hófst árið 1789 og breytti því hvernig fólk hugsaði um völd.",
    "Til að finna flatarmál þríhyrnings er grunnlínan margfölduð með hæðinni og deilt með tveimur.",
    "Vatn sýður við hundrað gráður á Celsíus þegar það er við sjávarmál.",
  ],
  ga: [
    "Is é fótaisintéis an próiseas trína n-úsáideann plandaí glasa solas na gréine chun a mbia féin a dhéanamh.",
    "Thosaigh Réabhlóid na Fraince sa bhliain 1789 agus d'athraigh sí an chaoi a smaoinigh daoine ar chumhacht.",
    "Chun achar triantáin a fháil, déan an bonn a iolrú faoin airde agus roinn ar a dó é.",
    "Fiuchann uisce ag céad céim Celsius nuair atá sé ag leibhéal na farraige.",
  ],
  cy: [
    "Ffotosynthesis yw'r broses lle mae planhigion gwyrdd yn defnyddio golau'r haul i wneud eu bwyd eu hunain.",
    "Dechreuodd y Chwyldro Ffrengig yn 1789 a newidiodd y ffordd roedd pobl yn meddwl am bŵer.",
    "I ddarganfod arwynebedd triongl, lluoswch y sylfaen â'r uchder a rhannwch y cyfan â dau.",
    "Mae dŵr yn berwi ar gant gradd Celsius pan fydd ar lefel y môr.",
  ],
  mt: [
    "Il-fotosintesi hija l-proċess li bih il-pjanti ħodor jużaw id-dawl tax-xemx biex jagħmlu l-ikel tagħhom.",
    "Ir-Rivoluzzjoni Franċiża bdiet fl-1789 u biddlet il-mod kif in-nies kienu jaħsbu dwar il-poter.",
    "Biex issib l-erja ta' trijangolu, timmultiplika l-bażi bl-għoli u taqsam bi tnejn.",
    "L-ilma jagħli f'mitt grad Celsius meta jkun fil-livell tal-baħar.",
  ],
  sw: [
    "Usanisinuru ni mchakato ambao mimea ya kijani hutumia mwanga wa jua kutengeneza chakula chake yenyewe.",
    "Mapinduzi ya Ufaransa yalianza mwaka 1789 na yalibadilisha jinsi watu walivyofikiri kuhusu mamlaka.",
    "Ili kupata eneo la pembetatu, zidisha kitako kwa kimo kisha gawanya kwa mbili.",
    "Maji huchemka kwa nyuzi joto mia moja katika usawa wa bahari.",
  ],
  so: [
    "Sawir-qaadashada iftiinka waa habka ay dhirta cagaaran u isticmaasho iftiinka qorraxda si ay u samaysato cuntadeeda.",
    "Kacaankii Faransiiska wuxuu bilaabmay sannadkii 1789 wuxuuna beddelay sida dadku uga fekeri jireen awoodda.",
    "Si aad u hesho bedka saddex-xagalka, ku dhufo saldhigga dhererka kadibna u qaybi laba.",
    "Biyuhu waxay ku karaan boqol darajo oo Celsius ah marka ay joogaan heerka badda.",
  ],
  zu: [
    "I-photosynthesis yinqubo lapho izitshalo eziluhlaza zisebenzisa ukukhanya kwelanga ukwenza ukudla kwazo.",
    "Inguquko yaseFrance yaqala ngo-1789 futhi yashintsha indlela abantu ababecabanga ngayo ngamandla.",
    "Ukuze uthole indawo kanxantathu, phindaphinda isisekelo ngobude bese uhlukanisa ngamabili.",
    "Amanzi abila ngamadigri ayikhulu eCelsius uma esezingeni lolwandle.",
  ],
  ca: [
    "La fotosíntesi és el procés pel qual les plantes verdes fan servir la llum del sol per fabricar el seu propi aliment.",
    "La Revolució Francesa va començar el 1789 i va canviar la manera com la gent pensava sobre el poder.",
    "Per calcular l'àrea d'un triangle, es multiplica la base per l'altura i es divideix entre dos.",
    "L'aigua bull a cent graus Celsius quan és al nivell del mar.",
  ],
  gl: [
    "A fotosíntese é o proceso polo cal as plantas verdes usan a luz do sol para fabricar o seu propio alimento.",
    "A Revolución Francesa comezou en 1789 e cambiou a forma en que a xente pensaba sobre o poder.",
    "Para calcular a área dun triángulo, multiplícase a base pola altura e divídese entre dous.",
    "A auga ferve a cen graos Celsius cando está ao nivel do mar.",
  ],
};

/* A fifth, longer sentence per language so the "long notes" read like a real section. */
const LATIN_EXTRA: Record<string, string> = {
  en: "Cells are the basic unit of life, and every living thing is made of one or more of them.",
  fr: "La cellule est l'unité de base du vivant, et tous les êtres vivants sont formés d'une ou de plusieurs cellules.",
  es: "La célula es la unidad básica de la vida, y todos los seres vivos están formados por una o más células.",
  pt: "A célula é a unidade básica da vida, e todos os seres vivos são formados por uma ou mais células.",
  it: "La cellula è l'unità fondamentale della vita, e tutti gli esseri viventi sono formati da una o più cellule.",
  de: "Die Zelle ist die Grundeinheit des Lebens, und alle Lebewesen bestehen aus einer oder mehreren Zellen.",
  nl: "De cel is de basiseenheid van het leven, en alle levende wezens bestaan uit een of meer cellen.",
  af: "Die sel is die basiese eenheid van lewe, en alle lewende dinge bestaan uit een of meer selle.",
  sv: "Cellen är livets minsta enhet, och alla levande varelser består av en eller flera celler.",
  nb: "Cellen er livets minste enhet, og alle levende vesener består av en eller flere celler.",
  da: "Cellen er livets mindste enhed, og alle levende væsener består af en eller flere celler.",
  fi: "Solu on elämän perusyksikkö, ja kaikki elävät olennot koostuvat yhdestä tai useammasta solusta.",
  et: "Rakk on elu põhiüksus ja kõik elusolendid koosnevad ühest või mitmest rakust.",
  pl: "Komórka jest podstawową jednostką życia, a wszystkie organizmy żywe składają się z jednej lub wielu komórek.",
  cs: "Buňka je základní jednotkou života a všechny živé organismy se skládají z jedné nebo více buněk.",
  sk: "Bunka je základnou jednotkou života a všetky živé organizmy sa skladajú z jednej alebo viacerých buniek.",
  hr: "Stanica je osnovna jedinica života i svi živi organizmi sastoje se od jedne ili više stanica.",
  sl: "Celica je osnovna enota življenja in vsi živi organizmi so sestavljeni iz ene ali več celic.",
  ro: "Celula este unitatea de bază a vieții, iar toate ființele vii sunt alcătuite din una sau mai multe celule.",
  hu: "A sejt az élet alapegysége, és minden élőlény egy vagy több sejtből áll.",
  tr: "Hücre yaşamın temel birimidir ve bütün canlılar bir ya da daha fazla hücreden oluşur.",
  az: "Hüceyrə həyatın əsas vahididir və bütün canlılar bir və ya daha çox hüceyrədən ibarətdir.",
  uz: "Hujayra hayotning asosiy birligi hisoblanadi va barcha tirik mavjudotlar bir yoki bir nechta hujayradan iborat.",
  id: "Sel adalah unit dasar kehidupan, dan semua makhluk hidup tersusun dari satu atau lebih sel.",
  ms: "Sel ialah unit asas kehidupan, dan semua benda hidup terdiri daripada satu atau lebih sel.",
  fil: "Ang selula ay ang pangunahing yunit ng buhay, at ang lahat ng may buhay ay binubuo ng isa o higit pang selula.",
  vi: "Tế bào là đơn vị cơ bản của sự sống, và mọi sinh vật đều được cấu tạo từ một hay nhiều tế bào.",
  lt: "Ląstelė yra pagrindinis gyvybės vienetas, o visi gyvi organizmai sudaryti iš vienos ar daugiau ląstelių.",
  lv: "Šūna ir dzīvības pamatvienība, un visi dzīvie organismi sastāv no vienas vai vairākām šūnām.",
  sq: "Qeliza është njësia bazë e jetës dhe të gjitha qeniet e gjalla përbëhen nga një ose më shumë qeliza.",
  is: "Fruman er grunneining lífsins og allar lífverur eru gerðar úr einni eða fleiri frumum.",
  ga: "Is í an chill bunaonad na beatha, agus tá gach rud beo déanta as cill amháin nó níos mó.",
  cy: "Y gell yw uned sylfaenol bywyd, ac mae pob peth byw wedi'i wneud o un gell neu fwy.",
  mt: "Iċ-ċellula hija l-unità bażika tal-ħajja, u l-organiżmi ħajjin kollha huma magħmula minn ċellula waħda jew aktar.",
  sw: "Seli ni kipimo cha msingi cha uhai, na viumbe hai vyote vimeundwa na seli moja au zaidi.",
  so: "Unugtu waa halbeegga aasaasiga ah ee nolosha, dhammaan noolaha waxay ka kooban yihiin hal unug ama ka badan.",
  zu: "Iseli liyiyunithi eyisisekelo yokuphila, futhi zonke izinto eziphilayo zakhiwe ngeseli elilodwa noma ngaphezulu.",
  ca: "La cèl·lula és la unitat bàsica de la vida, i tots els éssers vius estan formats per una o més cèl·lules.",
  gl: "A célula é a unidade básica da vida, e todos os seres vivos están formados por unha ou máis células.",
};

// ── Script languages: one lesson sentence and a second for long notes ───────

const SCRIPT_LESSONS: Record<string, [string, string]> = {
  ar: [
    "التمثيل الضوئي هو العملية التي تستخدم فيها النباتات الخضراء ضوء الشمس لصنع غذائها.",
    "تحتوي الخلية على نواة تحمل المادة الوراثية، ويمكن رؤيتها باستخدام المجهر.",
  ],
  fa: [
    "فتوسنتز فرایندی است که گیاهان سبز با استفاده از نور خورشید غذای خود را می‌سازند.",
    "سلول کوچک‌ترین واحد زنده است و همه موجودات زنده از سلول ساخته شده‌اند.",
  ],
  ur: [
    "ضیائی تالیف وہ عمل ہے جس کے ذریعے سبز پودے سورج کی روشنی سے اپنی خوراک بناتے ہیں۔",
    "خلیہ زندگی کی بنیادی اکائی ہے اور تمام جاندار خلیوں سے مل کر بنے ہوتے ہیں۔",
  ],
  ps: [
    "فوتوسنتیز هغه بهیر دی چې شنه بوټي یې د لمر له رڼا څخه د خپل خوراک جوړولو لپاره کاروي.",
    "حجره د ژوند تر ټولو کوچنی واحد دی او ټول ژوندي موجودات له حجرو څخه جوړ شوي دي.",
  ],
  he: [
    "פוטוסינתזה היא התהליך שבו צמחים ירוקים משתמשים באור השמש כדי לייצר מזון.",
    "התא הוא יחידת החיים הבסיסית, וכל היצורים החיים בנויים מתאים.",
  ],
  ru: [
    "Фотосинтез — это процесс, при котором зелёные растения используют солнечный свет для создания пищи.",
    "Клетка является основной единицей жизни, и все живые организмы состоят из клеток.",
  ],
  uk: [
    "Фотосинтез — це процес, під час якого зелені рослини використовують сонячне світло для створення їжі.",
    "Клітина є основною одиницею життя, і всі живі організми складаються з клітин.",
  ],
  bg: [
    "Фотосинтезата е процесът, при който зелените растения използват слънчевата светлина, за да произвеждат храна.",
    "Клетката е основната единица на живота и всички живи организми са изградени от клетки.",
  ],
  sr: [
    "Фотосинтеза је процес у коме зелене биљке користе сунчеву светлост да би произвеле храну.",
    "Ћелија је основна јединица живота и сви живи организми се састоје од ћелија.",
  ],
  mk: [
    "Фотосинтезата е процес во кој зелените растенија ја користат сончевата светлина за да произведат храна.",
    "Клетката е основна единица на животот и сите живи организми се составени од клетки.",
  ],
  kk: [
    "Фотосинтез — жасыл өсімдіктер күн сәулесін пайдаланып, өз қорегін түзетін процесс.",
    "Жасуша — тіршіліктің негізгі бірлігі және барлық тірі ағзалар жасушалардан тұрады.",
  ],
  mn: [
    "Фотосинтез бол ногоон ургамал нарны гэрлийг ашиглан өөрийн хоолыг бий болгодог үйл явц юм.",
    "Эс бол амьдралын үндсэн нэгж бөгөөд бүх амьд организм эсээс бүрддэг.",
  ],
  el: [
    "Η φωτοσύνθεση είναι η διαδικασία με την οποία τα πράσινα φυτά χρησιμοποιούν το φως του ήλιου.",
    "Το κύτταρο είναι η βασική μονάδα της ζωής και όλοι οι ζωντανοί οργανισμοί αποτελούνται από κύτταρα.",
  ],
  hi: [
    "प्रकाश संश्लेषण वह प्रक्रिया है जिसके द्वारा हरे पौधे सूर्य के प्रकाश से अपना भोजन बनाते हैं।",
    "कोशिका जीवन की मूल इकाई है और सभी जीवित प्राणी कोशिकाओं से मिलकर बने होते हैं।",
  ],
  mr: [
    "प्रकाशसंश्लेषण ही अशी प्रक्रिया आहे ज्यामध्ये हिरव्या वनस्पती सूर्यप्रकाशाचा वापर करून स्वतःचे अन्न तयार करतात.",
    "पेशी हा जीवनाचा मूलभूत घटक आहे आणि सर्व सजीव पेशींपासून बनलेले असतात.",
  ],
  ne: [
    "प्रकाश संश्लेषण त्यो प्रक्रिया हो जसमा हरिया बिरुवाहरूले सूर्यको प्रकाश प्रयोग गरेर आफ्नो खाना बनाउँछन्।",
    "कोष जीवनको आधारभूत एकाइ हो र सबै जीवित प्राणीहरू कोषहरूबाट बनेका हुन्छन्।",
  ],
  bn: [
    "সালোকসংশ্লেষণ হলো সেই প্রক্রিয়া যার মাধ্যমে সবুজ উদ্ভিদ সূর্যের আলো ব্যবহার করে নিজের খাদ্য তৈরি করে।",
    "কোষ হলো জীবনের মৌলিক একক এবং সকল জীব কোষ দিয়ে গঠিত।",
  ],
  pa: [
    "ਪ੍ਰਕਾਸ਼ ਸੰਸ਼ਲੇਸ਼ਣ ਉਹ ਪ੍ਰਕਿਰਿਆ ਹੈ ਜਿਸ ਰਾਹੀਂ ਹਰੇ ਪੌਦੇ ਸੂਰਜ ਦੀ ਰੌਸ਼ਨੀ ਨਾਲ ਆਪਣਾ ਭੋਜਨ ਬਣਾਉਂਦੇ ਹਨ।",
    "ਸੈੱਲ ਜੀਵਨ ਦੀ ਮੁੱਢਲੀ ਇਕਾਈ ਹੈ ਅਤੇ ਸਾਰੇ ਜੀਵ ਸੈੱਲਾਂ ਤੋਂ ਬਣੇ ਹੁੰਦੇ ਹਨ।",
  ],
  gu: [
    "પ્રકાશસંશ્લેષણ એ પ્રક્રિયા છે જેના દ્વારા લીલા છોડ સૂર્યપ્રકાશનો ઉપયોગ કરીને પોતાનો ખોરાક બનાવે છે.",
    "કોષ એ જીવનનો મૂળભૂત એકમ છે અને તમામ સજીવો કોષોના બનેલા છે.",
  ],
  ta: [
    "ஒளிச்சேர்க்கை என்பது பச்சை தாவரங்கள் சூரிய ஒளியைப் பயன்படுத்தி உணவு தயாரிக்கும் செயல்முறை ஆகும்.",
    "உயிரணு என்பது உயிரின் அடிப்படை அலகு ஆகும்.",
  ],
  te: [
    "కిరణజన్య సంయోగక్రియ అనేది ఆకుపచ్చ మొక్కలు సూర్యరశ్మిని ఉపయోగించి ఆహారాన్ని తయారుచేసుకునే ప్రక్రియ.",
    "కణం జీవానికి ప్రాథమిక ప్రమాణం.",
  ],
  kn: [
    "ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಎಂದರೆ ಹಸಿರು ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಬಳಸಿ ಆಹಾರವನ್ನು ತಯಾರಿಸುವ ಪ್ರಕ್ರಿಯೆ.",
    "ಜೀವಕೋಶವು ಜೀವದ ಮೂಲ ಘಟಕವಾಗಿದೆ.",
  ],
  ml: [
    "പച്ച സസ്യങ്ങൾ സൂര്യപ്രകാശം ഉപയോഗിച്ച് ആഹാരം നിർമ്മിക്കുന്ന പ്രക്രിയയാണ് പ്രകാശസംശ്ലേഷണം.",
    "കോശം ജീവന്റെ അടിസ്ഥാന ഘടകമാണ്.",
  ],
  si: [
    "ප්‍රභාසංශ්ලේෂණය යනු කොළ පැහැති ශාක සූර්ය ආලෝකය භාවිතයෙන් ආහාර නිපදවන ක්‍රියාවලියයි.",
    "සෛලය ජීවයේ මූලික ඒකකයයි.",
  ],
  th: [
    "การสังเคราะห์ด้วยแสงคือกระบวนการที่พืชสีเขียวใช้แสงอาทิตย์ในการสร้างอาหาร",
    "เซลล์เป็นหน่วยพื้นฐานของสิ่งมีชีวิตทุกชนิด",
  ],
  lo: [
    "ການສັງເຄາະແສງແມ່ນຂະບວນການທີ່ພືດສີຂຽວໃຊ້ແສງຕາເວັນເພື່ອສ້າງອາຫານ.",
    "ຈຸລັງແມ່ນຫົວໜ່ວຍພື້ນຖານຂອງສິ່ງມີຊີວິດ.",
  ],
  km: [
    "រស្មីសំយោគគឺជាដំណើរការដែលរុក្ខជាតិបៃតងប្រើពន្លឺព្រះអាទិត្យដើម្បីផលិតអាហារ។",
    "កោសិកាគឺជាឯកតាមូលដ្ឋាននៃជីវិត។",
  ],
  my: [
    "အလင်းစွမ်းအင်ဖြင့် အစာချက်ခြင်းသည် အစိမ်းရောင်အပင်များ နေရောင်ကို အသုံးပြု၍ အစာထုတ်လုပ်သည့် လုပ်ငန်းစဉ်ဖြစ်သည်။",
    "ဆဲလ်သည် သက်ရှိများ၏ အခြေခံယူနစ်ဖြစ်သည်။",
  ],
  ka: [
    "ფოტოსინთეზი არის პროცესი, რომლის დროსაც მწვანე მცენარეები მზის სინათლეს იყენებენ საკვების შესაქმნელად.",
    "უჯრედი სიცოცხლის ძირითადი ერთეულია.",
  ],
  hy: [
    "Ֆոտոսինթեզը այն գործընթացն է, որի ընթացքում կանաչ բույսերը օգտագործում են արևի լույսը սնունդ ստեղծելու համար։",
    "Բջիջը կյանքի հիմնական միավորն է։",
  ],
  am: [
    "ፎቶሲንተሲስ አረንጓዴ ተክሎች የፀሐይ ብርሃንን በመጠቀም ምግባቸውን የሚያዘጋጁበት ሂደት ነው።",
    "ሴል የሕይወት መሠረታዊ አሃድ ነው።",
  ],
  ko: [
    "광합성은 녹색 식물이 햇빛을 이용하여 스스로 양분을 만드는 과정입니다.",
    "세포는 생명의 기본 단위이며 모든 생물은 세포로 이루어져 있습니다.",
  ],
  ja: [
    "光合成とは、緑色植物が太陽の光を使って自分の栄養を作り出す仕組みのことです。",
    "細胞は生命の基本単位であり、すべての生物は細胞からできています。",
  ],
  zh: [
    "光合作用是绿色植物利用太阳光制造自身养分的过程。",
    "细胞是生命的基本单位，所有生物都是由细胞构成的。",
  ],
};

// ── English that must stay English ───────────────────────────────────────────

const ENGLISH_TRAPS = [
  "Marie Curie discovered radium and polonium in 1898.",
  "Déjà vu is the feeling that you have lived this moment before.",
  "We ordered coffee and croissants at the café near the Louvre.",
  "Per se, the law does not forbid it.",
  "A priori knowledge does not depend on experience.",
  "The status quo was maintained after the treaty.",
  "Smith et al. found that the enzyme works best at 37 °C.",
  "Homo sapiens first appeared in Africa about 300,000 years ago.",
  "Escherichia coli is a bacterium that lives in the gut.",
  "Tyrannosaurus rex lived during the late Cretaceous period.",
  "E = mc²",
  "for (let i = 0; i < n; i++) { total += values[i]; }",
  "var x = 10; if (x > 5) { console.log(x); }",
  "The speed of the car was 60 km/h, or about 16.7 m/s.",
  "Dissolve 5 g of NaCl in 100 mL of water.",
  'In French, people often say "Ça va?" to ask how you are.',
  "In French, people often say « Ça va ? » to ask how you are.",
  "OK",
  "Yes.",
  "No, thanks.",
  "Leonardo da Vinci painted the Mona Lisa.",
  "La Niña and El Niño are opposite phases of a climate pattern.",
  "The Tour de France is a famous bicycle race.",
  "Vive la différence!",
  "Bon appétit, everyone!",
  "Tsunami, karaoke and origami are words borrowed from Japanese.",
  "The Spanish word fiesta means party.",
  "Angela Merkel was the chancellor of Germany for sixteen years.",
  "Die Brücke was an art group founded in Dresden.",
  "Johann Sebastian Bach wrote the Brandenburg Concertos.",
  "The Rio Grande forms part of the border between the United States and Mexico.",
  "Mount Kilimanjaro is the highest mountain in Tanzania.",
  "Photosynthesis: 6CO2 + 6H2O → C6H12O6 + 6O2",
  "The pH of pure water is 7.",
  "Sushi, ramen and tempura are popular dishes.",
  "The café, the résumé and the fiancé all keep their accents in English.",
  "Café, résumé, naïve, fiancé, déjà vu, crème brûlée.",
  "Charles de Gaulle led the Free French during the war.",
  "The Treaty of Versailles was signed in the Hall of Mirrors.",
  "Air pressure decreases as altitude increases.",
  "sin x, cos x and tan x are trigonometric functions.",
  "The Victorian era lasted from 1837 to 1901.",
  "Pie charts show how a whole is divided into parts.",
  "Van Gogh painted The Starry Night in 1889.",
  "The motto of France is Liberté, égalité, fraternité.",
  "Carpe diem means seize the day.",
  "Hola means hello in Spanish.",
  "The word kindergarten comes from German.",
  "In vitro fertilisation was first successful in 1978.",
  "Merci beaucoup, madame.",
  "Dr. Martin Luther King Jr. gave his famous speech in 1963.",
  "Gauss, Euler and Riemann were great mathematicians.",
  "Pasteur, Koch and Lister founded modern microbiology.",
  "Mahatma Gandhi led India to independence.",
  "The capital of Italy is Rome, and the capital of Spain is Madrid.",
  "Nelson Mandela became president of South Africa in 1994.",
  "Sine, cosine and tangent relate the angles of a triangle to its sides.",
  "Is it true that DNA is a double helix?",
  "I think, therefore I am.",
  "Aloha is a Hawaiian greeting.",
  "Mitochondria produce ATP through cellular respiration.",
  "The mRNA carries the code from DNA to the ribosome, where tRNA brings amino acids.",
  "Use getElementById to find an element, then set its innerHTML.",
  "Vis-à-vis the new rules, nothing changes.",
  "The Louvre, the Musée d'Orsay and the Centre Pompidou are in Paris.",
  "Don Quixote was written by Miguel de Cervantes.",
  "The Bundestag is the German parliament.",
  "Ciao!",
  "Au revoir.",
  "Gracias.",
  "Danke schön.",
  "The formula is v = u + at, where a is the acceleration and t is the time.",
  "In the equation y = mx + c, m is the gradient and c is the y-intercept.",
  "Al Capone was a gangster in Chicago.",
  "Los Angeles and San Francisco are in California.",
  "Da Vinci, Michelangelo and Raphael were painters of the Renaissance.",
  "Ich bin ein Berliner is a famous line from a speech by John F. Kennedy.",
  "Veni, vidi, vici is what Julius Caesar is said to have written.",
  "The tomb of Tutankhamun was found in 1922.",
  "The Italian phrase 'la dolce vita' means the sweet life.",
  "In Spanish, 'de nada' means you're welcome.",
  "The German word Schadenfreude has no English equivalent.",
  "Allegro, andante and adagio are tempo markings in music.",
  "Da capo al fine",
  "Je ne regrette rien is a famous song by Édith Piaf.",
  "C'est la vie, as the French say.",
  "The Portuguese word saudade has no direct translation.",
  "Ein, zwei, drei, vier!",
  "Deus ex machina is a plot device.",
  "Cogito, ergo sum.",
  "The Italian saying 'chi va piano va sano' means slow and steady wins the race.",
  "I'm sure I've seen this before, and I'll check again.",
  "Roe v. Wade was decided in 1973.",
  "The Turkish words ağaç, kılıç and ışık mean tree, sword and light.",
  "In Polish, thank you is dziękuję and please is proszę.",
  "Antonín Dvořák, Paul Erdős and Nicolae Ceaușescu were born in Central and Eastern Europe.",
  "Lech Wałęsa, Krzysztof Kieślowski and Czesław Miłosz were famous Poles.",
  "The Czech words chléb, voda and sůl mean bread, water and salt.",
  "x = 3, y = 4 and z = x + y",
  "Let a = 2 and b = 5; then a + b = 7.",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const joined = (runs: Array<{ text: string }>) => runs.map((r) => r.text).join("");
const langsOf = (runs: Array<{ lang: string }>) => runs.map((r) => r.lang);
const hasLetter = (s: string) => /\p{L}/u.test(s);

/** The shape every speechRuns result must have, whatever the sentence. */
function assertWellFormed(sentence: string, base: string) {
  const runs = speechRuns(sentence, base);
  assert.equal(joined(runs), sentence, "joining the runs gives back the sentence");
  for (const r of runs) {
    assert.ok(r.text.length > 0, "no empty run");
    assert.ok(DETECTABLE.includes(r.lang), `run language ${r.lang} is detectable`);
    if (runs.length > 1) assert.ok(hasLetter(r.text), `run ${JSON.stringify(r.text)} has letters of its own`);
  }
  for (let i = 1; i < runs.length; i++) assert.notEqual(runs[i].lang, runs[i - 1].lang, "neighbours differ");
  return runs;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DETECTABLE", () => {
  const required = [
    "en", "fr", "es", "it", "pt", "de", "nl", "sv", "nb", "da", "fi", "pl", "cs", "sk", "ro", "hu", "tr", "id",
    "ms", "vi", "hr", "sl", "lt", "lv", "et", "sq", "is", "ga", "cy", "mt", "sw", "af", "fil",
    "ar", "fa", "ur", "he", "ru", "uk", "bg", "sr", "mk", "kk", "mn", "el", "hi", "mr", "ne", "bn", "pa", "gu",
    "ta", "te", "kn", "ml", "si", "th", "lo", "km", "my", "ka", "hy", "am", "ko", "ja", "zh",
  ];
  test("lists every language the voice map needs", () => {
    for (const l of required) assert.ok(DETECTABLE.includes(l), l);
  });
  test("holds lower-case base codes only, no duplicates", () => {
    assert.equal(new Set(DETECTABLE).size, DETECTABLE.length);
    for (const l of DETECTABLE) assert.match(l, /^[a-z]{2,3}$/);
  });
  test("is frozen", () => {
    assert.ok(Object.isFrozen(DETECTABLE));
  });
});

describe("English stays English", () => {
  for (const s of ENGLISH_TRAPS) {
    test(`hint en: ${s}`, () => assert.equal(detectLang(s, "en").lang, "en"));
    test(`no hint: ${s}`, () => assert.equal(detectLang(s).lang, "en"));
    test(`runs stay en: ${s}`, () => {
      const runs = assertWellFormed(s, "en");
      assert.deepEqual(langsOf(runs), ["en"]);
    });
  }
  test("a whole English paragraph full of names and loanwords stays English, confidently", () => {
    const r = detectLang(ENGLISH_TRAPS.join(" "), "en");
    assert.equal(r.lang, "en");
  });
});

describe("Latin-script lessons", () => {
  // One sentence with no hint: the right language, or English when the sentence
  // is too short on evidence (a harmless miss), but never another language.
  let right = 0;
  let total = 0;
  for (const [lang, sentences] of Object.entries(LATIN_LESSONS)) {
    describe(lang, () => {
      sentences.forEach((s, i) => {
        test(`sentence ${i + 1}, no hint: ${lang} or a safe miss`, () => {
          const got = detectLang(s).lang;
          total++;
          if (got === lang) right++;
          assert.ok(got === lang || got === "en", `got ${got}`);
        });
        test(`sentence ${i + 1}, own hint`, () => assert.equal(detectLang(s, lang).lang, lang));
        test(`sentence ${i + 1} read in a ${lang} lesson is one ${lang} run`, () => {
          assert.deepEqual(langsOf(assertWellFormed(s, lang)), [lang]);
        });
      });
      test("long notes are recognised with confidence", () => {
        const notes = [...sentences, LATIN_EXTRA[lang]].join(" ");
        const r = detectLang(notes);
        assert.equal(r.lang, lang);
        assert.ok(r.confidence >= 0.6, `confidence ${r.confidence}`);
      });
      test("long notes win even against another hint", () => {
        const notes = [...sentences, LATIN_EXTRA[lang]].join("\n");
        const other = lang === "en" ? "fr" : "en";
        assert.equal(detectLang(notes, other).lang, lang);
      });
    });
  }
  test("single sentences with no hint are mostly recognised (over 90%)", () => {
    assert.equal(total, Object.values(LATIN_LESSONS).flat().length);
    assert.ok(right / total >= 0.9, `${right}/${total}`);
  });
});

describe("script languages", () => {
  for (const [lang, [s1, s2]] of Object.entries(SCRIPT_LESSONS)) {
    describe(lang, () => {
      test("sentence, no hint", () => assert.equal(detectLang(s1).lang, lang));
      test("sentence, English hint", () => assert.equal(detectLang(s1, "en").lang, lang));
      test("sentence, own hint", () => assert.equal(detectLang(s1, lang).lang, lang));
      test("long notes", () => {
        const r = detectLang(`${s1} ${s2}\n${s1}`);
        assert.equal(r.lang, lang);
        assert.ok(r.confidence >= 0.6, `confidence ${r.confidence}`);
      });
      test("one run in its own lesson", () => {
        assert.deepEqual(langsOf(assertWellFormed(s1, lang)), [lang]);
      });
      test("one run inside an English lesson too", () => {
        assert.deepEqual(langsOf(assertWellFormed(s2, "en")), [lang]);
      });
    });
  }
});

describe("letters that name the language", () => {
  const cases: Array<[string, string]> = [
    ["Їжак їсть яблуко.", "uk"],
    ["Європа є континентом.", "uk"],
    ["Ґудзик на пальті.", "uk"],
    ["Ђак учи ћирилицу.", "sr"],
    ["Љубав и њежност.", "sr"],
    ["Ќерка ги сака ѕвездите.", "mk"],
    ["Қазақстан — үлкен ел.", "kk"],
    ["Өнөөдөр цаг агаар сайхан байна.", "mn"],
    ["Съм тук и чакам.", "bg"],
    ["Это наш дом.", "ru"],
    ["Мы учимся в школе.", "ru"],
    ["پنجره باز است.", "fa"],
    ["گربه روی میز است.", "fa"],
    ["یہ ٹرین ہے۔", "ur"],
    ["وہ بڑا گھر ہے۔", "ur"],
    ["دا ښځه ډېره ښه ده.", "ps"],
    ["هذه مدرسة كبيرة.", "ar"],
    ["मराठी भाषा खूप सुंदर आहे आणि ती बोलायला सोपी आहे.", "mr"],
    ["नेपाली भाषा धेरै राम्रो छ र यो सिक्न सजिलो हुन्छ।", "ne"],
    ["हिंदी एक सुंदर भाषा है और यह बोलने में आसान है।", "hi"],
    ["ひらがなとカタカナ", "ja"],
    ["漢字とかな", "ja"],
    ["汉字", "zh"],
    ["한국어", "ko"],
    ["ქართული", "ka"],
    ["Հայերեն", "hy"],
    ["አማርኛ", "am"],
    ["ภาษาไทย", "th"],
    ["ພາສາລາວ", "lo"],
    ["ភាសាខ្មែរ", "km"],
    ["မြန်မာဘာသာ", "my"],
    ["עברית", "he"],
    ["Ελληνικά", "el"],
    ["বাংলা", "bn"],
    ["ਪੰਜਾਬੀ", "pa"],
    ["ગુજરાતી", "gu"],
    ["தமிழ்", "ta"],
    ["తెలుగు", "te"],
    ["ಕನ್ನಡ", "kn"],
    ["മലയാളം", "ml"],
    ["සිංහල", "si"],
  ];
  for (const [text, lang] of cases) {
    test(`${text} → ${lang}`, () => assert.equal(detectLang(text).lang, lang));
  }
});

describe("short text leans on the hint", () => {
  test("a one-word French reply stays in the lesson language", () => {
    assert.equal(detectLang("Oui.", "fr").lang, "fr");
    assert.equal(detectLang("Oui.", "en").lang, "en");
  });
  test("a three-word French line in an English lesson is a (harmless) miss, not a switch", () => {
    assert.equal(detectLang("Je suis là.", "en").lang, "en");
  });
  test("OK in a German lesson stays German", () => assert.equal(detectLang("OK", "de").lang, "de"));
  test("Cyrillic with no telling letters follows a Cyrillic hint", () => {
    assert.equal(detectLang("Привет", "uk").lang, "uk");
    assert.equal(detectLang("Привет", "bg").lang, "bg");
    assert.equal(detectLang("Привет").lang, "ru");
    assert.equal(detectLang("Привет", "en").lang, "ru");
  });
  test("but Russian-only letters beat a Ukrainian hint when the text is long enough", () => {
    assert.equal(detectLang(SCRIPT_LESSONS.ru.join(" "), "uk").lang, "ru");
  });
  test("kanji alone follows a Japanese hint, else Chinese", () => {
    assert.equal(detectLang("東京大学", "ja").lang, "ja");
    assert.equal(detectLang("東京大学").lang, "zh");
    assert.equal(detectLang("东京大学", "en").lang, "zh");
  });
  test("kana makes it Japanese whatever the hint", () => {
    assert.equal(detectLang("ありがとう", "zh").lang, "ja");
  });
  test("an Arabic-script word with nothing telling follows the hint", () => {
    assert.equal(detectLang("سلام", "fa").lang, "fa");
    assert.equal(detectLang("سلام", "ur").lang, "ur");
    assert.equal(detectLang("سلام").lang, "ar");
  });
  test("Devanagari with nothing telling is Hindi unless the lesson is Marathi or Nepali", () => {
    assert.equal(detectLang("नमस्ते", "mr").lang, "mr");
    assert.equal(detectLang("नमस्ते", "ne").lang, "ne");
    assert.equal(detectLang("नमस्ते").lang, "hi");
  });
  test("short foreign line in a matching lesson keeps the lesson", () => {
    assert.equal(detectLang("Bonjour à tous", "fr").lang, "fr");
    assert.equal(detectLang("Hola a todos", "es").lang, "es");
  });
  test("short ambiguous text reports low confidence", () => {
    assert.ok(detectLang("OK", "en").confidence <= 0.3);
    assert.ok(detectLang("Je suis là.", "en").confidence <= 0.3);
  });
});

describe("hints", () => {
  const fr = LATIN_LESSONS.fr[0];
  test("BCP-47 hints use their base", () => {
    assert.equal(detectLang("OK", "fr-FR").lang, "fr");
    assert.equal(detectLang("OK", "pt_BR").lang, "pt");
    assert.equal(detectLang("光", "zh-Hant-TW").lang, "zh");
  });
  test("old and alternative codes", () => {
    assert.equal(detectLang("OK", "tl").lang, "fil");
    assert.equal(detectLang("OK", "fil-PH").lang, "fil");
    assert.equal(detectLang("OK", "no").lang, "nb");
    assert.equal(detectLang("OK", "in").lang, "id");
    assert.equal(detectLang("שלום", "iw").lang, "he");
  });
  test("an unknown hint falls back to English", () => {
    assert.equal(detectLang("OK", "xx").lang, "en");
    assert.equal(detectLang("OK", "").lang, "en");
    assert.equal(detectLang("OK", undefined).lang, "en");
  });
  test("a hint in another script does not stop a Latin text being read as itself", () => {
    assert.equal(detectLang(fr, "ar").lang, "fr");
    assert.equal(detectLang("The cell is the basic unit of life.", "ar").lang, "en");
  });
  test("with a non-Latin hint, weak Latin text is English, not the hint", () => {
    assert.equal(detectLang("OK", "ar").lang, "en");
    assert.equal(detectLang("DNA", "ja").lang, "en");
  });
  test("an English sentence in a French lesson switches to English", () => {
    assert.equal(detectLang("The mitochondria is the powerhouse of the cell and makes energy.", "fr").lang, "en");
  });
});

describe("odd input never throws", () => {
  const odd: unknown[] = ["", "   ", "12345", "?!…", "😀🎉", "\u0000\u0001", null, undefined, 42, {}, "a", "'", "'n"];
  for (const x of odd) {
    test(`detectLang(${JSON.stringify(x)})`, () => {
      const r = detectLang(x as string, "de");
      assert.ok(DETECTABLE.includes(r.lang));
      assert.ok(r.confidence >= 0 && r.confidence <= 1);
    });
    test(`speechRuns(${JSON.stringify(x)})`, () => {
      const runs = speechRuns(x as string, "de");
      assert.ok(Array.isArray(runs));
      if (typeof x === "string") assert.equal(joined(runs), x);
    });
  }
  test("empty text keeps the hint with zero confidence", () => {
    assert.deepEqual(detectLang("", "fr"), { lang: "fr", confidence: 0 });
  });
  test("a sentence with no letters is one run in the base language", () => {
    assert.deepEqual(speechRuns("42.", "fr"), [{ text: "42.", lang: "fr" }]);
    assert.deepEqual(speechRuns("", "fr"), []);
  });
  test("an unknown base is treated as English", () => {
    assert.deepEqual(langsOf(speechRuns("Bonjour tout le monde", "xx")), ["en"]);
  });
  test("lone surrogates and unusual scripts keep the text intact", () => {
    const s = "Tibetan བོད་ and Oriya ଓଡ଼ିଆ \ud800 end.";
    assert.equal(joined(speechRuns(s, "en")), s);
  });
});

describe("speechRuns: mixed sentences", () => {
  test("English + Arabic phrase", () => {
    const runs = assertWellFormed("The Arabic greeting السلام عليكم means peace be upon you.", "en");
    assert.deepEqual(langsOf(runs), ["en", "ar", "en"]);
    assert.equal(runs[1].text, "السلام عليكم ");
  });
  test("English + quoted Arabic word keeps the quote marks with it", () => {
    const runs = assertWellFormed("The Arabic word for peace is «سلام» in most dialects.", "en");
    assert.deepEqual(langsOf(runs), ["en", "ar", "en"]);
    assert.equal(runs[1].text, "«سلام» ");
  });
  test("Arabic + English acronym", () => {
    const runs = assertWellFormed("يحمل الحمض النووي DNA المعلومات الوراثية.", "ar");
    assert.deepEqual(langsOf(runs), ["ar", "en", "ar"]);
    assert.equal(runs[1].text, "DNA ");
  });
  test("Arabic sentence starting with an English term", () => {
    const runs = assertWellFormed("DNA هو الحمض النووي.", "ar");
    assert.deepEqual(langsOf(runs), ["en", "ar"]);
  });
  test("Arabic + English term in parentheses", () => {
    const runs = assertWellFormed("تسمى هذه العملية التمثيل الضوئي (photosynthesis) في اللغة الإنجليزية.", "ar");
    assert.deepEqual(langsOf(runs), ["ar", "en", "ar"]);
    assert.equal(runs[1].text, "(photosynthesis) ");
  });
  test("French lesson + English term stays French", () => {
    const s = "En informatique, on parle souvent de machine learning pour désigner l'apprentissage automatique.";
    assert.deepEqual(langsOf(assertWellFormed(s, "fr")), ["fr"]);
  });
  test("German lesson + English loanwords stays German", () => {
    const s = "Viele Schüler nutzen heute ein Tablet oder einen Laptop, um ihre Hausaufgaben online abzugeben.";
    assert.deepEqual(langsOf(assertWellFormed(s, "de")), ["de"]);
  });
  test("Hindi + English code-mixing: each script to its own voice", () => {
    const s = "Photosynthesis एक process है जिसमें plants sunlight का use करते हैं।";
    const runs = assertWellFormed(s, "hi");
    assert.deepEqual(langsOf(runs), ["en", "hi", "en", "hi", "en", "hi", "en", "hi"]);
    assert.equal(runs[4].text, "plants sunlight ");
  });
  test("Hinglish notes are Hindi overall", () => {
    const s = "Photosynthesis एक process है जिसमें plants sunlight का use करते हैं। यह बहुत important topic है।";
    assert.equal(detectLang(s).lang, "hi");
    assert.equal(detectLang(s, "hi").lang, "hi");
  });
  test("Japanese with a Latin acronym", () => {
    const runs = assertWellFormed("DNAは細胞の核の中にあります。", "ja");
    assert.deepEqual(langsOf(runs), ["en", "ja"]);
  });
  test("Chinese with an English word in full-width brackets", () => {
    const runs = assertWellFormed("光合作用（photosynthesis）是植物的过程。", "zh");
    assert.deepEqual(langsOf(runs), ["zh", "en", "zh"]);
    assert.equal(runs[1].text, "（photosynthesis）");
  });
  test("a kanji-only phrase inside a Japanese lesson is Japanese", () => {
    const runs = assertWellFormed("The word 東京 means eastern capital.", "ja");
    assert.deepEqual(langsOf(runs), ["en", "ja", "en"]);
  });
  test("a single Chinese character is still its own run", () => {
    const runs = assertWellFormed("The character 水 means water.", "en");
    assert.deepEqual(langsOf(runs), ["en", "zh", "en"]);
  });
  test("a Russian word in an English sentence", () => {
    const runs = assertWellFormed("Russians say спасибо to thank someone.", "en");
    assert.deepEqual(langsOf(runs), ["en", "ru", "en"]);
  });
  test("Ukrainian words are recognised by their letters and words", () => {
    const runs = assertWellFormed("In Ukrainian, thank you is дякую, and bread is хліб; the country is Україна.", "en");
    assert.deepEqual(langsOf(runs), ["en", "uk", "en", "uk", "en", "uk"]);
    assert.equal(runs[5].text, "Україна.");
  });
  test("a Cyrillic word with nothing telling defaults to Russian", () => {
    const runs = assertWellFormed("The word молоко means milk.", "en");
    assert.deepEqual(langsOf(runs), ["en", "ru", "en"]);
  });
  test("Greek word inside English science text", () => {
    const runs = assertWellFormed("The prefix bio comes from the Greek βίος, meaning life.", "en");
    assert.deepEqual(langsOf(runs), ["en", "el", "en"]);
  });
  test("Hebrew phrase inside English", () => {
    const runs = assertWellFormed("The Hebrew greeting שלום עליכם is used in many songs.", "en");
    assert.deepEqual(langsOf(runs), ["en", "he", "en"]);
  });
  test("Korean inside English", () => {
    const runs = assertWellFormed("In Korean, hello is 안녕하세요 and thank you is 감사합니다.", "en");
    assert.deepEqual(langsOf(runs), ["en", "ko", "en", "ko"]);
  });
  test("Persian lesson with an Arabic quotation", () => {
    const runs = assertWellFormed("این جمله عربی است: العلم نور.", "fa");
    assert.equal(joined(runs), "این جمله عربی است: العلم نور.");
    assert.equal(runs[0].lang, "fa");
  });
  test("English words inside a Russian lesson are English", () => {
    const runs = assertWellFormed("Слово computer пришло из английского языка.", "ru");
    assert.deepEqual(langsOf(runs), ["ru", "en", "ru"]);
  });
  test("a French sentence quoted inside an Arabic lesson gets the French voice", () => {
    const runs = assertWellFormed("قال ديكارت: Je pense, donc je suis, et je le crois vraiment.", "ar");
    assert.deepEqual(langsOf(runs), ["ar", "fr"]);
  });
  test("a Spanish phrase in a Hindi lesson with too little evidence falls back to English", () => {
    const runs = assertWellFormed("स्पेनिश में hola का मतलब नमस्ते है।", "hi");
    assert.deepEqual(langsOf(runs), ["hi", "en", "hi"]);
  });
});

describe("speechRuns: Latin-script switching", () => {
  test("a whole French sentence in an English lesson switches", () => {
    assert.deepEqual(langsOf(assertWellFormed("Je pense que la cellule est très importante pour la vie.", "en")), ["fr"]);
  });
  test("a whole Spanish sentence in an English lesson switches", () => {
    const s = "La fotosíntesis es el proceso por el cual las plantas fabrican su alimento.";
    assert.deepEqual(langsOf(assertWellFormed(s, "en")), ["es"]);
  });
  test("an English sentence in a French lesson switches to English", () => {
    const s = "The mitochondria is the powerhouse of the cell, and it makes most of its energy.";
    assert.deepEqual(langsOf(assertWellFormed(s, "fr")), ["en"]);
  });
  test("a quoted French sentence inside an English sentence gets its own run", () => {
    const runs = assertWellFormed('He wrote: "La vie est belle et le monde est grand."', "en");
    assert.deepEqual(langsOf(runs), ["en", "fr"]);
    assert.equal(runs[1].text, '"La vie est belle et le monde est grand."');
  });
  test("French guillemets in the middle of an English sentence", () => {
    const runs = assertWellFormed("He said « je ne sais pas du tout » and left the room.", "en");
    assert.deepEqual(langsOf(runs), ["en", "fr", "en"]);
    assert.equal(runs[1].text, "« je ne sais pas du tout »");
  });
  test("German curly quotes", () => {
    const runs = assertWellFormed("Her teacher always said „Übung macht den Meister, und das ist wahr“ before tests.", "en");
    assert.deepEqual(langsOf(runs), ["en", "de", "en"]);
  });
  test("a short quote stays in the lesson voice", () => {
    assert.deepEqual(langsOf(assertWellFormed('The French say "bon courage" before an exam.', "en")), ["en"]);
  });
  test("an English title in quotes stays English", () => {
    assert.deepEqual(langsOf(assertWellFormed('She read "The Old Man and the Sea" last year.', "en")), ["en"]);
  });
  test("apostrophes are not quotes", () => {
    const s = "The students' results don't show it's the teachers' fault.";
    assert.deepEqual(langsOf(assertWellFormed(s, "en")), ["en"]);
  });
  test("a four-word French sentence alone does not flip an English lesson", () => {
    assert.deepEqual(langsOf(assertWellFormed("Je ne sais pas.", "en")), ["en"]);
  });
  test("Portuguese sentence in a Spanish lesson switches to Portuguese", () => {
    const s = "Não é possível fazer isso sem a ajuda de uma pessoa que já sabe como funciona.";
    assert.deepEqual(langsOf(assertWellFormed(s, "es")), ["pt"]);
  });
  test("a Spanish sentence stays Spanish in a Spanish lesson even with English names", () => {
    const s = "Isaac Newton publicó sus leyes del movimiento en el año 1687.";
    assert.deepEqual(langsOf(assertWellFormed(s, "es")), ["es"]);
  });
});

describe("speechRuns: small pieces", () => {
  test("Greek variable letters stay with the English sentence", () => {
    assert.deepEqual(langsOf(assertWellFormed("The angle θ is equal to π divided by four.", "en")), ["en"]);
  });
  test("Δx stays with its sentence", () => {
    assert.deepEqual(langsOf(assertWellFormed("The change Δx is small.", "en")), ["en"]);
  });
  test("a lone Latin letter inside Arabic stays Arabic", () => {
    assert.deepEqual(langsOf(assertWellFormed("المتغير x يساوي خمسة.", "ar")), ["ar"]);
  });
  test("a lone Arabic letter inside English stays English", () => {
    assert.deepEqual(langsOf(assertWellFormed("The letter ب is the second letter.", "en")), ["en"]);
  });
  test("digits and punctuation attach to their neighbours", () => {
    const runs = assertWellFormed("Chapter 3 الفصل الثالث, page 12.", "en");
    assert.deepEqual(langsOf(runs), ["en", "ar", "en"]);
    assert.equal(runs[0].text, "Chapter 3 ");
    assert.equal(runs[1].text, "الفصل الثالث, ");
  });
  test("no space between scripts", () => {
    const runs = assertWellFormed("DNA-الحمض", "en");
    assert.deepEqual(langsOf(runs), ["en", "ar"]);
    assert.equal(runs[0].text, "DNA-");
  });
  test("leading punctuation goes with the first run", () => {
    const runs = assertWellFormed("«سلام» means peace.", "en");
    assert.deepEqual(langsOf(runs), ["ar", "en"]);
    assert.equal(runs[0].text, "«سلام» ");
  });
  test("Arabic with vowel marks and tatweel is one run", () => {
    assert.deepEqual(langsOf(assertWellFormed("بِسْمِ اللَّهِ الرَّحْمَـٰنِ", "en")), ["ar"]);
  });
  test("Persian zero-width non-joiners stay inside the run", () => {
    assert.deepEqual(langsOf(assertWellFormed("می‌خواهم کتاب‌ها را بخوانم.", "fa")), ["fa"]);
  });
  test("Sinhala joiners stay inside the run", () => {
    assert.deepEqual(langsOf(assertWellFormed(SCRIPT_LESSONS.si[0], "en")), ["si"]);
  });
  test("emoji never make a run", () => {
    assert.deepEqual(langsOf(assertWellFormed("Great job 🎉 مبروك 🎉!", "en")), ["en", "ar"]);
  });
});

describe("speechRuns: invariants over the whole corpus", () => {
  const all = [
    ...Object.values(LATIN_LESSONS).flat(),
    ...Object.values(LATIN_EXTRA),
    ...Object.values(SCRIPT_LESSONS).flat(),
    ...ENGLISH_TRAPS,
  ];
  for (const base of ["en", "fr", "ar", "hi", "ja", "ru"]) {
    test(`every corpus sentence is well formed with base ${base}`, () => {
      for (const s of all) assertWellFormed(s, base);
    });
  }
  test("stitched mixed-script sentences round-trip exactly", () => {
    const parts = Object.values(SCRIPT_LESSONS).map(([a]) => a.slice(0, 20));
    for (let i = 0; i + 2 < parts.length; i++) {
      const s = `Note: ${parts[i]} (${parts[i + 1]}) — ${parts[i + 2]}!`;
      assertWellFormed(s, "en");
    }
  });
});

describe("fuzz: random mixed text never breaks the contract", () => {
  // A fixed-seed generator so a failure can be replayed.
  let seed = 20260925;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pieces = [
    "the ", "and ", "la ", "de ", "und ", "że ", "và ", "ya ", "'n ", "il-", "l'", "don't ", "«", "»", "“", "”", '"', "'",
    "(", ")", "（", "）", ", ", ". ", "? ", "! ", " ", "  ", "\n", "123", "٣", "३", "%", "=", "+", "x", "θ", "π",
    "السلام", "عليكم", "کتاب", "ہے", "שלום", "привет", "дякую", "नमस्ते", "আমি", "ਪੰਜਾਬ", "தமிழ்", "తెలుగు",
    "ಕನ್ನಡ", "മലയാളം", "සිංහල", "ภาษาไทย", "ລາວ", "ខ្មែរ", "မြန်မာ", "ქართული", "Հայերեն", "አማርኛ", "한국어", "日本語",
    "ひらがな", "中文", "水", "é", "\u0301", "\u200c", "\u200d", "\u064e", "😀", "🎉", "\ud83d", "ß", "ł", "ə", "ő", "ř",
  ];
  for (let k = 0; k < 300; k++) {
    let s = "";
    const n = 1 + Math.floor(rand() * 14);
    for (let i = 0; i < n; i++) s += pieces[Math.floor(rand() * pieces.length)];
    const base = DETECTABLE[Math.floor(rand() * DETECTABLE.length)];
    test(`case ${k} (${base})`, () => {
      const runs = speechRuns(s, base);
      assert.equal(joined(runs), s);
      for (const r of runs) {
        assert.ok(r.text.length > 0);
        assert.ok(DETECTABLE.includes(r.lang));
      }
      for (let i = 1; i < runs.length; i++) assert.notEqual(runs[i].lang, runs[i - 1].lang);
      const d = detectLang(s, base);
      assert.ok(DETECTABLE.includes(d.lang));
      assert.ok(d.confidence >= 0 && d.confidence <= 1);
    });
  }
});

describe("speed", () => {
  test("a long section's notes are judged quickly", () => {
    const notes = Object.values(LATIN_LESSONS).flat().join(" ").repeat(6);
    const t0 = performance.now();
    detectLang(notes, "en");
    assert.ok(performance.now() - t0 < 500, "under half a second");
  });
  test("a thousand sentences are cut quickly", () => {
    const all = [...Object.values(LATIN_LESSONS).flat(), ...Object.values(SCRIPT_LESSONS).flat()];
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) speechRuns(all[i % all.length], "en");
    assert.ok(performance.now() - t0 < 1500, `took ${Math.round(performance.now() - t0)} ms`);
  });
});
