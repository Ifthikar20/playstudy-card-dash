import { Link } from "react-router-dom";
import LegalDocument, {
  B,
  ContactDetails,
  Fill,
  H3,
  List,
  Mail,
  linkClass,
  type LegalSection,
} from "@/components/legal/LegalDocument";
import { LEGAL } from "@/lib/legal";

/*
  Privacy Policy. Shares its layout and copy helpers with the Terms of Service
  (components/legal/LegalDocument) and the operator's details with it too
  (lib/legal).

  Every statement here was checked against the code on 21 September 2026: what
  the models store, which hosts the backend calls, what the browser keeps and
  what it loads from elsewhere. If a feature changes what it collects or who
  it sends data to, this page has to change with it. In particular, the
  provider list in "sharing" mirrors the outbound calls in playstudy-backend
  (DeepSeek, Anthropic, Perplexity, Speechify, the edge-tts fallback, YouTube
  via the Webshare proxy) and the scripts index.html loads (Google Fonts,
  reCAPTCHA).
*/

const EFFECTIVE = "21 September 2026";

type SectionId =
  | "who-we-are"
  | "what-we-collect"
  | "how-we-use"
  | "ai-and-voice"
  | "children"
  | "sharing"
  | "cookies"
  | "retention"
  | "your-rights"
  | "security"
  | "transfers"
  | "us-states"
  | "other-services"
  | "changes"
  | "contact";

type Section = LegalSection & { id: SectionId };

function TermsLink() {
  return (
    <Link to="/terms" className={linkClass}>
      Terms of Service
    </Link>
  );
}

/** "section 4" (or just "4" when `bare`), linked to that section. */
function Ref({ to, bare = false }: { to: SectionId; bare?: boolean }) {
  const n = SECTIONS.findIndex((s) => s.id === to) + 1;
  return (
    <a href={`#${to}`} className={linkClass}>
      {bare ? n : `section ${n}`}
    </a>
  );
}

function External({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

/* Who processes information on our behalf: name, where, what they get. */
const PROVIDERS: [name: string, where: string, what: string][] = [
  ["Amazon Web Services", "United States", "Hosts our servers and the database where your account and study material are kept."],
  [
    "Cloudflare",
    "Worldwide",
    "Runs our domain and network security, carrying traffic between your browser and our servers. When bot checks are switched on, it checks sign-ins for automated traffic.",
  ],
  ["DeepSeek", "China", "Writes notes, quizzes and flashcards, and answers questions, from the text we send it."],
  ["Anthropic", "United States", "Does the same kind of writing for some features."],
  ["Perplexity", "United States", "Finds pictures for Teach mode lessons, using the lesson's topic."],
  ["Speechify", "United States", "Turns the passage being read aloud into speech."],
  ["Microsoft", "Worldwide", "A backup voice, used when Speechify isn't available."],
  ["Webshare", "Worldwide", "A proxy network our server uses to reach YouTube. It carries our request for a video, not your details."],
  [
    "Google",
    "United States",
    "Serves the fonts on our pages and YouTube videos you add; handles Google sign-in if you use it; and provides the reCAPTCHA script our pages load (see section 7).",
  ],
  [
    "Other sign-in services",
    "Varies",
    "Microsoft, or your organisation's single sign-on provider (through WorkOS), only if you sign in with them.",
  ],
];

function ProviderList() {
  return (
    <div className="divide-y divide-[var(--hair)] rounded-[var(--r-card)] border border-[var(--hair)] bg-[var(--cream-alt)]">
      {PROVIDERS.map(([name, where, what]) => (
        <div key={name} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
          <div>
            <p className="text-[14px] font-semibold text-[var(--ink)]">{name}</p>
            <p className="text-[12.5px] text-[var(--muted-2)]">{where}</p>
          </div>
          <p className="min-w-0 text-[14.5px] leading-[1.6] text-[var(--muted)]">{what}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- the short version ---------- */

const SUMMARY: [lead: string, text: string][] = [
  [
    "No ads, no third-party trackers.",
    "We don't show ads, we don't use advertising or third-party analytics trackers, and we never sell your information. We keep our own record of which pages are used and what goes wrong, so we can fix it.",
  ],
  [
    "Your material is used to help you study.",
    "We use what you upload and write to make your notes, quizzes, flashcards and lessons, and to run your account.",
  ],
  [
    "AI services do some of the work.",
    "To write notes and read them aloud, we send the text involved to the AI and voice providers listed below. One of them, DeepSeek, processes data in China.",
  ],
  [
    "Children use profiles a parent creates.",
    "A child signs in with a name and a PIN, never an email address. The parent sees their progress and can delete the profile at any time.",
  ],
  [
    "Parents see progress, not writing.",
    "A connected parent or guardian sees study time, accuracy and answers, never the notes a learner has written.",
  ],
  [
    "Some things stay with you.",
    "Your calendar lives only in your browser, and voice recordings sent to us are deleted as soon as they've been turned into text.",
  ],
  ["You're in control.", `Ask for a copy of your information, or for it to be corrected or deleted, at ${LEGAL.email}.`],
];

/* ---------- the policy ---------- */

const SECTIONS: Section[] = [
  {
    id: "who-we-are",
    title: "Who we are and what this covers",
    body: (
      <>
        <p>
          This Privacy Policy explains how <Fill>{LEGAL.entity}</Fill> ("we", "us" or "our") collects, uses and shares
          information when you use AnotherNotes at {LEGAL.website}, including our website, web app and related services.
          We decide how that information is used, which makes us responsible for it (its "controller").
        </p>
        <p>
          It applies to everyone who uses AnotherNotes: learners with their own accounts, children using a profile a
          parent or guardian set up, parents and guardians, and people whose school or organisation gives them access. If
          your school or organisation provides your account, it decides how AnotherNotes is used for its members and may
          be responsible for your information under its agreement with us, so its own privacy notice applies too.
        </p>
        <p>
          Please read this together with our <TermsLink />. If anything here is unclear, email <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "Information we collect",
    body: (
      <>
        <H3>Information you give us</H3>
        <List>
          <li>
            <B>Account details.</B> Your name, email address and password. We store your password only as a one-way hash,
            so nobody at AnotherNotes can read it. If you sign in with Google, Microsoft or your organisation's single
            sign-on, we receive your name, email address and an account identifier from that service, never your
            password for it.
          </li>
          <li>
            <B>Profile and settings.</B> Whether you're a student or a teacher, the organisation you belong to, and your
            preferences, such as the voice that reads to you.
          </li>
          <li>
            <B>Child profiles.</B> When a parent or guardian creates one, they give us the child's name, a username, a
            six-digit PIN and, if they choose, the child's year of birth. We never ask a child for an email address. The
            PIN is stored only as a one-way hash.
          </li>
          <li>
            <B>Study material.</B> Files you upload (PDF, Word, PowerPoint, text and Markdown), text you paste in, and
            YouTube links you add. We keep the original file with the study session it belongs to, along with the text we
            take from it.
          </li>
          <li>
            <B>What you create.</B> Your notes and edits, sticky notes, folders, flashcards and quizzes, and the questions
            you ask in Teach mode. When an answer is written into your notes, it's saved with them.
          </li>
          <li>
            <B>Your voice, if you use it.</B> If you ask a question out loud, your browser may turn your speech into text
            itself (in Google Chrome, this happens on Google's servers). If it can't, it sends us a short recording, which
            our own server turns into text and then deletes straight away.
          </li>
          <li>
            <B>Messages.</B> If you email us, we receive your email address and whatever you include.
          </li>
        </List>

        <H3>Information created as you study</H3>
        <List>
          <li>
            <B>Answers.</B> Which quiz questions you answered, whether each answer was right, and when.
          </li>
          <li>
            <B>Study time and progress.</B> How many minutes a day you spend actively reading and writing (time only counts
            while you're active), and the XP and streaks worked out from it.
          </li>
        </List>

        <H3>Information collected automatically</H3>
        <List>
          <li>
            <B>Technical information.</B> When your browser talks to our servers, we receive your IP address, browser and
            device type, what was requested, and when. Our servers also log changes made to accounts, including which
            account made them and from which IP address. We use this to keep AnotherNotes secure, stop abuse and fix
            problems.
          </li>
          <li>
            <B>Usage and error records.</B> Which pages of AnotherNotes are opened, a few actions (such as starting Teach
            mode or creating a study session) and any errors, with a random ID for your browser and one for each visit,
            plus the campaign tags or click IDs in the link you followed to reach us (such as utm_source). This stays on
            our own servers. We use it to find and fix problems and to see which links bring people to AnotherNotes. It
            never includes your notes, questions or answers.
          </li>
          <li>
            <B>Browser storage and cookies.</B> We keep your sign-in and some app data in your browser. See{" "}
            <Ref to="cookies" />.
          </li>
        </List>

        <H3>Information from other people and services</H3>
        <List>
          <li>
            A parent or guardian who creates a child profile, or whom a learner connects using a code (see{" "}
            <Ref to="children" />
            ).
          </li>
          <li>
            Your school or organisation, if it provides your account, and the sign-in service you use: your name, email
            address and that you're a member.
          </li>
          <li>
            A service you connect to import notes, where that's available. We receive access to the items you choose, and
            keep the access token the service gives us so we can import from it again. You can disconnect it at any time.
          </li>
        </List>

        <p>
          <B>Please be careful what you upload.</B> AnotherNotes is for study material. Please don't upload health
          information, government ID numbers, bank details, passwords or other people's personal information. Anything
          you upload may be processed by the providers listed in <Ref to="sharing" />.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use information",
    body: (
      <>
        <p>We use information to:</p>
        <List>
          <li>
            <B>Run AnotherNotes for you:</B> turn your material into notes, quizzes, flashcards and Teach mode lessons,
            read sections aloud, answer your questions, find pictures for lessons, and save your work so it's there next
            time.
          </li>
          <li>
            <B>Keep accounts safe:</B> sign you in and keep you signed in, lock a child profile after too many wrong PINs,
            limit how often requests can be made, spot and stop abuse, and fix bugs.
          </li>
          <li>
            <B>Run family and organisation features:</B> show a connected parent or guardian how a learner is getting on
            (see <Ref to="children" />
            ), and let an organisation manage the accounts it provides.
          </li>
          <li>
            <B>Improve AnotherNotes:</B> understand which features work and where things go wrong, using aggregated
            information that doesn't identify you wherever we can.
          </li>
          <li>
            <B>Talk to you:</B> reply to your messages, and tell you about important changes to AnotherNotes, your account
            or our policies. We don't send marketing emails.
          </li>
          <li>
            <B>Meet our legal obligations:</B> comply with the law, enforce our terms, and protect the rights and safety of
            our users and others.
          </li>
        </List>
        <p>
          <B>What we don't do.</B> We don't show ads. We don't sell personal information or share it for targeted
          advertising. We don't use your information to make decisions about you that have legal or similarly
          significant effects. And we don't train AI models on your content; we don't have models of our own.
        </p>
        <H3>Legal bases (EEA and UK)</H3>
        <p>
          If you're in the European Economic Area or the United Kingdom, we rely on: <B>contract</B>, to provide the
          service you've asked for; <B>legitimate interests</B>, to keep AnotherNotes secure, prevent abuse and improve
          it, where your interests don't outweigh ours; <B>consent</B>, where we ask for it, including a parent's consent
          for a child's profile, which can be withdrawn at any time; and <B>legal obligation</B>, where the law requires
          us to use information.
        </p>
      </>
    ),
  },
  {
    id: "ai-and-voice",
    title: "How AI and voice features handle your content",
    body: (
      <>
        <p>
          AnotherNotes doesn't run its own AI models. When it writes notes, makes questions or flashcards, answers a
          question or reads a section aloud, our server sends the material needed for that task to one of the providers
          in <Ref to="sharing" /> and saves what comes back.
        </p>
        <List>
          <li>
            <B>What they receive.</B> The text involved: a section of your material, your question, or the passage being
            read aloud. We don't send your name or email address with it.
          </li>
          <li>
            <B>What they do with it.</B> They process it to give us a result. How long they keep it, and whether they may
            use it for anything else, is set by their own terms for business customers, which you can find on their
            websites.
          </li>
          <li>
            <B>DeepSeek.</B> Much of the writing is done by DeepSeek, which processes data in China (see{" "}
            <Ref to="transfers" />
            ).
          </li>
          <li>
            <B>YouTube.</B> When you add a YouTube link, our server fetches the video's captions or audio from YouTube,
            sometimes through a proxy network so the request isn't blocked, and turns any audio into text on our own
            servers.
          </li>
          <li>
            <B>Pictures.</B> To find a picture for a lesson, we search Perplexity and Wikipedia using the lesson's topic,
            not your personal details.
          </li>
          <li>
            <B>Accuracy.</B> AI can get things wrong, so check anything important against your own material. Our{" "}
            <TermsLink /> say more.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "children",
    title: "Children and families",
    body: (
      <>
        <p>Children use AnotherNotes, so we collect only what the service needs from them.</p>
        <H3>Who can have an account</H3>
        <p>
          You need to be at least 13, or older where the law requires, to create your own account. A younger child can
          use AnotherNotes only through a profile that a parent or guardian creates, or through a school that has
          authorised it.
        </p>
        <H3>What we collect from a child profile</H3>
        <p>
          The child's name, username, PIN (as a one-way hash) and, if the parent adds it, year of birth; the material the
          child studies and the notes they write; their answers; and their study time. We don't ask for a child's email
          address, and we never show children ads.
        </p>
        <H3>Parental consent and control</H3>
        <p>
          A parent or guardian who creates a profile gives their consent for us to collect and use the child's
          information as this policy describes. A parent or guardian can:
        </p>
        <List>
          <li>see the child's progress, as described below;</li>
          <li>set a new PIN at any time;</li>
          <li>
            delete the profile in AnotherNotes, which stops it working straight away, and ask us to erase its data (see{" "}
            <Ref to="retention" />
            );
          </li>
          <li>
            ask for a copy of the information we hold about the child, or for us to stop collecting it, by emailing{" "}
            <Mail subject="About my child's information" />.
          </li>
        </List>
        <H3>What a parent or guardian can see</H3>
        <p>
          For a child profile they created: what's being studied, study time, accuracy and streaks, and the quiz questions
          answered, with the right answer and explanation for each mistake. For a learner who connected them with a code:
          progress, but not answers. A parent or guardian never sees the notes a learner has written. A learner with their
          own account can see who is connected to them, and a link made with a code ends automatically when the learner
          turns 18.
        </p>
        <H3>Schools</H3>
        <p>
          If a school provides AnotherNotes to its pupils, the school is responsible for any parental consent the law
          requires, under its agreement with us.
        </p>
        <p>
          If you think a child under 13 has created their own account, email <Mail subject="Child account" /> and we'll
          deal with it quickly, which may mean deleting the account.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share information with",
    body: (
      <>
        <p>We share information only as described here, and we never sell it.</p>
        <H3>Service providers</H3>
        <p>These companies process information on our behalf, only to provide their part of AnotherNotes:</p>
        <ProviderList />
        <H3>Others</H3>
        <List>
          <li>
            <B>People you connect with.</B> A parent or guardian connected to a learner, as described in{" "}
            <Ref to="children" />.
          </li>
          <li>
            <B>Your organisation.</B> If your school or organisation provides your account, it may see your account details
            and how you use AnotherNotes, as its agreement with us allows.
          </li>
          <li>
            <B>Legal and safety reasons.</B> When we believe in good faith that the law requires it, or that it's needed to
            protect someone's safety, investigate fraud or abuse, or defend our rights.
          </li>
          <li>
            <B>Business changes.</B> If AnotherNotes is merged, acquired or sold, information may pass to the new owner,
            who must honour this policy. We'll tell you before that happens.
          </li>
          <li>
            <B>With your agreement.</B> Anyone else, only when you ask us to or agree to it.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    body: (
      <>
        <p>We don't use advertising or third-party analytics cookies, and we don't track you across other websites.</p>
        <List>
          <li>
            <B>Signing in.</B> Your sign-in token is kept in your browser's local storage, so you stay signed in until you
            sign out.
          </li>
          <li>
            <B>App data.</B> Some data is kept in your browser for a few minutes so pages load quickly.
          </li>
          <li>
            <B>Your calendar.</B> Calendar events, including any .ics file you import, are stored only in your browser and
            aren't sent to our servers. Clearing your browser's data deletes them.
          </li>
          <li>
            <B>Preferences.</B> A small cookie remembers whether the side menu is open.
          </li>
          <li>
            <B>Visit IDs.</B> A random ID for your browser and one for each visit, and the campaign tags of the link that
            brought you, so our own usage and error records can be told apart. They aren't shared with anyone.
          </li>
          <li>
            <B>Cloudflare.</B> Our network provider may set cookies it needs to protect the site from attacks and bots.
          </li>
          <li>
            <B>Google.</B> Our pages load fonts from Google Fonts and Google's reCAPTCHA script, so Google receives your IP
            address and browser details when you visit. We don't currently use reCAPTCHA to check you. Google's{" "}
            <External href="https://policies.google.com/privacy">Privacy Policy</External> and{" "}
            <External href="https://policies.google.com/terms">Terms of Service</External> cover what it does with that
            information.
          </li>
        </List>
        <p>
          Because we don't track you across sites, or sell or share information for advertising, there's nothing for a
          "Do Not Track" or Global Privacy Control signal to switch off. You can block cookies and clear site data in your
          browser, but AnotherNotes needs local storage to keep you signed in.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep information",
    body: (
      <List>
        <li>
          <B>Your account and study material:</B> for as long as you have an account, unless you delete them sooner.
        </li>
        <li>
          <B>Closing your account:</B> email <Mail subject="Delete my account" /> from the address linked to your account,
          and we'll delete your account and content, apart from anything the law requires us to keep. We may ask you to
          confirm it's really you.
        </li>
        <li>
          <B>Child profiles:</B> deleting a profile in AnotherNotes stops it working straight away. To have its information
          erased from our systems as well, email us and we'll confirm when it's done.
        </li>
        <li>
          <B>Voice recordings sent to our server:</B> deleted as soon as they've been turned into text.
        </li>
        <li>
          <B>Server logs:</B> kept for a limited period for security and troubleshooting, then deleted.
        </li>
        <li>
          <B>Usage and error records:</B> 90 days, then deleted.
        </li>
        <li>
          <B>Backups:</B> where we keep backups, deleted information may remain in them for a limited period until they're
          replaced.
        </li>
        <li>
          <B>Aggregated information</B> that doesn't identify anyone may be kept for longer.
        </li>
      </List>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights and choices",
    body: (
      <>
        <p>Depending on where you live, you may have the right to:</p>
        <List>
          <li>find out what information we hold about you, and get a copy;</li>
          <li>have inaccurate information corrected;</li>
          <li>have your information deleted;</li>
          <li>receive your information in a portable format;</li>
          <li>object to, or ask us to restrict, how we use your information;</li>
          <li>withdraw your consent where we rely on it, without affecting what we did before.</li>
        </List>
        <p>
          To use any of these rights, email <Mail subject="Privacy request" /> from the address linked to your account. A
          parent or guardian can make a request for their child, and someone you authorise can make one for you. We may
          need to confirm your identity (and, for someone acting for you, their authority) first. We'll reply within one
          month, or sooner if the law requires, and we won't treat you differently for using your rights.
        </p>
        <p>
          If you're in the EEA or the UK and unhappy with how we've handled your information, you can complain to your
          local data protection authority (in the UK, the Information Commissioner's Office). We'd appreciate the chance
          to put things right first.
        </p>
        <H3>Choices you can make</H3>
        <List>
          <li>Type your questions instead of speaking them, if you'd rather not use your voice.</li>
          <li>Leave anything sensitive out of what you upload.</li>
          <li>Disconnect a connected service, or delete study sessions you no longer need.</li>
        </List>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <>
        <p>We protect information with measures that suit what we hold, including:</p>
        <List>
          <li>encrypted connections (HTTPS) to {LEGAL.website};</li>
          <li>passwords and PINs stored only as one-way hashes, with an extra secret key for PINs;</li>
          <li>encryption of some stored content;</li>
          <li>limits on how often requests can be made, and lockouts after repeated wrong PINs;</li>
          <li>access to personal information limited to the people who need it to run AnotherNotes.</li>
        </List>
        <p>
          No service can be completely secure, so we can't promise that information will never be accessed or disclosed
          without permission. If a breach affects you, we'll tell you where the law requires. If you find a security
          problem, please report it to <Mail subject="Security report" />.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Our servers are in the United States, and some of our providers process information in other countries,
        including DeepSeek in China. These countries may not have the same data protection laws as where you live. Where
        the law requires safeguards for these transfers, we use the mechanisms available for each provider, such as
        standard contractual clauses. Email <Mail /> if you'd like to know more.
      </p>
    ),
  },
  {
    id: "us-states",
    title: "Additional information for US residents",
    body: (
      <>
        <p>
          Some US states, including California, give residents extra rights. Those rights are covered in{" "}
          <Ref to="your-rights" />, and this section adds the details those laws ask for.
        </p>
        <List>
          <li>
            <B>Categories we collect.</B> Identifiers (name, email address, username, IP address, account identifiers);
            account credentials (stored as hashes); education information (study material, notes, answers and study
            time); internet activity (how you use AnotherNotes); and, briefly, audio (spoken questions sent to our
            server). The sources and purposes are set out in <Ref to="what-we-collect" /> and <Ref to="how-we-use" />, and
            who receives them in <Ref to="sharing" />.
          </li>
          <li>
            <B>Sensitive information.</B> We use account credentials, and information about children, only to provide
            AnotherNotes and keep it secure, as the law allows.
          </li>
          <li>
            <B>No selling or sharing.</B> We don't sell personal information or share it for cross-context behavioural
            advertising, and haven't in the last 12 months, including information about anyone under 16.
          </li>
          <li>
            <B>Appeals.</B> If we turn down a request, you can appeal by replying to our answer. We'll look at it again,
            tell you the outcome, and explain how to contact your state's attorney general if you're still unhappy.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "other-services",
    title: "Other websites and services",
    body: (
      <p>
        AnotherNotes links to and works with other services, such as YouTube videos you add, Wikipedia pages credited
        under lesson pictures, and services you sign in with or connect. Their own privacy policies cover what they
        collect, and this policy doesn't, so please read theirs.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We'll update this policy as AnotherNotes changes. If we make an important change, we'll tell you in the app or by
        email before it takes effect (for a child profile, we'll tell the parent or guardian who set it up). The date at
        the top shows when it last changed.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        <p>If you have questions about this policy or how we handle information, get in touch:</p>
        <ContactDetails />
      </>
    ),
  },
];

/* ---------- page ---------- */

const PrivacyPage = () => (
  <LegalDocument
    title="Privacy Policy"
    effective={EFFECTIVE}
    intro="What AnotherNotes collects about you and the learners you look after, why, who else sees it, and the choices you have. We've written it to be read. If anything's unclear, just ask."
    summary={SUMMARY}
    summaryNote="This summary is only here to help you find your way. The full policy below is what applies."
    sections={SECTIONS}
    skipLabel="Skip to the policy"
    current="/privacy"
  />
);

export default PrivacyPage;
