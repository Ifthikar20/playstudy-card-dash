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
  Terms of Service. The layout, the contents list and the small copy helpers
  are shared with the Privacy Policy (components/legal/LegalDocument), and who
  operates AnotherNotes lives in lib/legal, so the two documents cannot drift
  apart. Cross-references use <Ref>, which looks its number up in SECTIONS, so
  reordering sections cannot leave a stale "see section 4" behind.
*/

const EFFECTIVE = "21 September 2026";

type SectionId =
  | "agreement"
  | "who-can-use"
  | "your-account"
  | "families"
  | "organisations"
  | "your-content"
  | "ai-content"
  | "acceptable-use"
  | "third-parties"
  | "intellectual-property"
  | "copyright"
  | "fees"
  | "privacy"
  | "ending-your-account"
  | "changes"
  | "disclaimers"
  | "liability"
  | "indemnity"
  | "governing-law"
  | "general"
  | "contact";

type Section = LegalSection & { id: SectionId };

function PrivacyLink() {
  return (
    <Link to="/privacy" className={linkClass}>
      Privacy Policy
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

/* ---------- the short version ---------- */

const SUMMARY: [lead: string, text: string][] = [
  [
    "It's in beta, and it's free.",
    "Features may change or stop, and it won't always be available, so keep your own copies of anything important.",
  ],
  ["Your content stays yours.", "We use it only to run and improve AnotherNotes, and we don't sell it."],
  ["AI can be wrong.", "Check what it produces against your own material, and follow your school's rules on AI."],
  [
    "Age rules.",
    "You need to be 13 or older (older where local law requires) to have your own account. Younger children use a child profile set up by a parent or guardian, or access their school has authorised.",
  ],
  [
    "Parents can follow along.",
    "A connected parent or guardian sees progress, such as time, accuracy, streaks and questions answered, but not written notes. A learner can't unlink them (a link made with a code ends when the learner turns 18).",
  ],
  [
    "Use it fairly.",
    "Nothing illegal, nothing you don't have the right to use, and no hacking, scraping or overloading.",
  ],
  [
    "You can leave at any time.",
    "Ask and we'll delete your account. We'll give you notice before important changes to these terms.",
  ],
];

/* ---------- the terms ---------- */

const SECTIONS: Section[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    body: (
      <>
        <p>
          These Terms of Service (also called terms and conditions) are a legal agreement between you and{" "}
          <Fill>{LEGAL.entity}</Fill> ("we", "us" or "our"). They cover your use of AnotherNotes, including our website,
          web app and related services.
        </p>
        <p>
          AnotherNotes is a study tool. You add material, such as PDFs, slides, notes, pasted text or a YouTube link, and
          it creates written notes for each section, quizzes, flashcards and Teach mode, where a synthetic voice reads a
          section aloud and answers your questions. You can also write your own notes and sticky notes, organise sessions
          into folders, use a calendar and track your progress with XP and streaks.
        </p>
        <p>
          By creating an account or using AnotherNotes, you agree to these terms. If you don't agree, please don't use
          it. If a feature has extra terms, we'll show them to you first, and they become part of this agreement.
        </p>
        <p>
          If you accept these terms for someone else, such as a child or an organisation, you confirm that you're
          authorised to do so. "You" then means both you and them.
        </p>
      </>
    ),
  },
  {
    id: "who-can-use",
    title: "Who can use AnotherNotes",
    body: (
      <>
        <H3>Age</H3>
        <List>
          <li>
            You must be at least 13 to create your own account, or older if the law where you live sets a higher age
            for agreeing to online services yourself (the "age of digital consent").
          </li>
          <li>
            Younger children may use AnotherNotes only through a child profile set up by a parent or guardian (see{" "}
            <Ref to="families" />), or through a school or organisation that has authorised it (see{" "}
            <Ref to="organisations" />).
          </li>
          <li>
            If you're under 18, or under the age of majority where you live, you need a parent's or guardian's
            permission to use AnotherNotes. They accept these terms for you and are responsible for your use of it.
          </li>
        </List>
        <p>We may suspend or close an account that breaks these age rules.</p>
        <H3>Beta and new accounts</H3>
        <p>
          AnotherNotes is in beta. It's still being built and tested, so things will change and won't always work
          perfectly (see sections <Ref bare to="changes" /> and <Ref bare to="disclaimers" />). We may limit or pause new
          sign-ups, or offer new accounts by invitation only, at any time.
        </p>
        <p>
          You can't use AnotherNotes if we've previously closed your account for breaking these terms (unless we agree
          otherwise), or if the law doesn't allow you to use it.
        </p>
      </>
    ),
  },
  {
    id: "your-account",
    title: "Your account",
    body: (
      <>
        <p>
          <B>Accurate details.</B> Give us accurate information and keep it up to date, especially your email address,
          as that's how we contact you.
        </p>
        <p>
          <B>Signing in.</B> You can sign in with an email address and password. Some people can also use a Google or
          Microsoft account, or their school's or organisation's single sign-on (see <Ref to="third-parties" />).
        </p>
        <p>
          <B>Keep it secure.</B> Keep your password, and a child profile's six-digit PIN, secret. Don't share them, and
          don't reuse a password from somewhere else. You're responsible for what happens on your account, unless it
          happens because we didn't take reasonable care.
        </p>
        <p>
          <B>One person per account.</B> Each account and each child profile is for one person. Don't let anyone else
          use yours, and don't use anyone else's.
        </p>
        <p>
          <B>Lockouts.</B> To protect accounts, we may temporarily lock an account or child profile, or slow down
          sign-in, after repeated failed attempts. A child who is locked out should ask the parent or guardian who set up
          their profile.
        </p>
        <p>
          <B>Tell us about misuse.</B> If you think someone else has used your account, or knows your password or PIN,
          tell us straight away at <Mail />.
        </p>
        <p>
          <B>XP, streaks and study time.</B> These show your progress. Study time counts only the minutes you spend
          actively reading or writing. They have no monetary value, can't be exchanged or transferred, and we may change
          how they're worked out or correct them if they're wrong.
        </p>
      </>
    ),
  },
  {
    id: "families",
    title: "Parents, guardians and child profiles",
    body: (
      <>
        <H3>Child profiles</H3>
        <p>
          A parent or guardian can create a child profile from their own account. The child signs in with a name and a
          six-digit PIN, so no email address is needed. By creating a child profile, you:
        </p>
        <List>
          <li>confirm that you're the child's parent or legal guardian;</li>
          <li>
            accept these terms for the child, and are responsible for their use of AnotherNotes, including supervising it
            in a way that suits their age; and
          </li>
          <li>agree to keep the PIN private, and to set a new one if you think someone else knows it.</li>
        </List>
        <H3>Connecting a learner's own account</H3>
        <p>
          A learner who already has their own account can connect a parent or guardian by sharing a code with them. If
          you're the learner, only share your code with your own parent or guardian.
        </p>
        <H3>What a parent or guardian can see</H3>
        <p>
          A connected parent or guardian can see how the learner is getting on, such as what they're studying, how long
          they study, their accuracy and streaks, and the questions they've answered. What's shown can differ between a
          child profile and a learner's own account. A parent or guardian can't see the learner's written notes. A
          learner with their own account can see who is connected to them.
        </p>
        <H3>Ending a connection</H3>
        <p>
          A learner can't unlink a parent or guardian. This is deliberate. A connection that a learner made by sharing a
          code ends automatically when they turn 18, going by the birth year on their account; a child profile that a
          parent or guardian created doesn't end this way. A parent or guardian can stop following a learner, or delete a
          child profile they created, which permanently removes the profile and what has been studied in it. If a
          connection was made by mistake or shouldn't exist, contact us at <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "organisations",
    title: "Schools and organisations",
    body: (
      <>
        <p>
          If a school, university, employer or other organisation gives you access to AnotherNotes (for example, through
          single sign-on for its email domain):
        </p>
        <List>
          <li>its agreement with us, and its own rules and policies, may also apply to you;</li>
          <li>it may be able to manage your account, and access information in it, as that agreement allows; and</li>
          <li>
            you may lose access if you leave the organisation or its agreement with us ends, so keep copies of anything
            you need.
          </li>
        </List>
        <p>
          If you accept these terms for an organisation, you confirm that you're authorised to bind it. The organisation
          is responsible for having the permissions it needs to give its users access, including consent from parents or
          guardians where the law requires it. If its written agreement with us conflicts with these terms, that
          agreement takes priority for the organisation and its users.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <>
        <p>
          "Your content" means anything you add to AnotherNotes: files you upload, text you paste, links you share,
          questions you ask, and the notes, sticky notes, folders and calendar entries you create or import.
        </p>
        <H3>It stays yours</H3>
        <p>
          You keep all the rights you have in your content, and we don't claim ownership of it.{" "}
          <B>We don't sell your content.</B>
        </p>
        <H3>The permission you give us</H3>
        <p>
          You give us a worldwide, non-exclusive, royalty-free licence to host, store, copy, process, transform (for
          example, into notes, quizzes, flashcards and audio), format and display your content, solely to run and improve
          AnotherNotes. Our service providers may do these things for us, for the same purposes (see{" "}
          <Ref to="third-parties" /> and our <PrivacyLink />). The licence ends when your content is deleted, except for
          copies kept for a limited time in backups or where the law requires us to keep them.
        </p>
        <H3>What AnotherNotes creates for you</H3>
        <p>
          We don't claim ownership of the notes, quizzes, flashcards, answers, audio and other material AnotherNotes
          creates for you ("outputs"). You can use them, subject to these terms and to the rights of others, including
          the owners of any material they're based on. Other people may receive similar outputs.
        </p>
        <H3>Your responsibilities</H3>
        <p>You're responsible for your content. When you add it, you confirm that:</p>
        <List>
          <li>
            you own it, or have permission to use it in this way, including material written by others, such as
            textbooks, lecture slides and articles;
          </li>
          <li>
            using it here doesn't break the law or anyone else's rights, such as copyright, privacy or confidentiality;
            and
          </li>
          <li>it doesn't include other people's personal information, unless you're allowed to share it.</li>
        </List>
        <p>
          When you paste a link, for example to a YouTube video, you ask us to retrieve what we need from it (such as the
          transcript) to create your study material. Only link to content you're allowed to use this way. It stays
          subject to its owners' rights and the platform's own terms (see <Ref to="third-parties" />).
        </p>
        <H3>Removing content</H3>
        <p>
          You can delete content wherever AnotherNotes gives you the option, or ask us to delete your account (see{" "}
          <Ref to="ending-your-account" />). We may remove or restrict content that we reasonably believe breaks these
          terms or the law, or could cause harm, and where appropriate we'll tell you why.
        </p>
        <p>
          We don't review content as a matter of course. We may look at it where needed, for example to fix a problem
          you've reported, to investigate a complaint or a suspected breach of these terms, or where the law requires it.
        </p>
        <p>AnotherNotes isn't a backup service, so keep your own copies of anything important.</p>
      </>
    ),
  },
  {
    id: "ai-content",
    title: "AI-generated content",
    body: (
      <>
        <p>
          AnotherNotes uses artificial intelligence (AI) to create notes, answers, quizzes, flashcards and spoken
          explanations from your content and questions. To do this, we send the material needed to third-party service
          providers, including AI model providers and text-to-speech and voice providers (see our <PrivacyLink />).
        </p>
        <H3>AI can be wrong</H3>
        <p>
          Outputs can be inaccurate, incomplete, out of date or misleading, even when they sound confident. A quiz can
          mark a right answer as wrong, and a summary can miss what matters. Check anything important against your
          original material, your teachers' guidance or other reliable sources, especially before an exam.
        </p>
        <H3>Not professional advice</H3>
        <p>
          Outputs are for learning only. They aren't medical, legal, financial or other professional advice, and you
          shouldn't rely on them for decisions about your health, safety, money or legal position.
        </p>
        <H3>Academic integrity</H3>
        <p>
          Follow the rules of your school, university or exam board on AI and study tools. Don't use AnotherNotes to
          cheat, and don't hand in AI-generated work as your own where that isn't allowed. You're responsible for how you
          use outputs.
        </p>
        <H3>Voice features</H3>
        <List>
          <li>
            In Teach mode, a synthetic (computer-generated) voice reads a section aloud and points to the line it's on.
            It isn't a real person and may mispronounce words, so rely on the written notes.
          </li>
          <li>
            You can ask questions by typing or, if you choose, by speaking, which needs your permission to use your
            microphone. Depending on your browser, your speech is turned into text either by the browser's own speech
            service, under its provider's terms, or by us.
          </li>
          <li>Answers are written into your notes. Check them as you would any other output.</li>
        </List>
        <p>
          Please report outputs that are harmful, offensive or badly wrong to <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You must not do, try to do, or help anyone else to do any of the following:</p>
        <List>
          <li>
            upload, create or share anything illegal, harmful, threatening, abusive, hateful or sexually explicit, or
            anything that exploits or endangers children;
          </li>
          <li>bully, harass, threaten or intimidate anyone;</li>
          <li>upload or share other people's personal information without their permission;</li>
          <li>
            upload material that infringes someone else's copyright, trade marks or other rights, or that you don't have
            permission to use;
          </li>
          <li>upload viruses, malware or other harmful code;</li>
          <li>
            use bots, scrapers or other automated tools to access AnotherNotes or collect data from it, without our
            written permission;
          </li>
          <li>get around or interfere with bot checks (such as CAPTCHAs), rate limits or security features;</li>
          <li>
            decompile, reverse engineer or try to extract the source code of AnotherNotes, except where the law allows
            it;
          </li>
          <li>overload or disrupt AnotherNotes or its systems, for example by sending an excessive number of requests;</li>
          <li>
            sell, resell, rent, sub-license or otherwise commercially exploit AnotherNotes or access to it, without our
            written permission;
          </li>
          <li>
            impersonate anyone, or misrepresent your connection with anyone, including by pretending to be someone's
            parent or guardian;
          </li>
          <li>
            access, or try to access, anyone else's account, child profile or data, including by guessing passwords, PINs
            or codes; or
          </li>
          <li>use AnotherNotes in any other way that breaks the law or these terms.</li>
        </List>
        <p>
          If we reasonably believe you've broken these rules, we may remove content and suspend or close your account
          (see <Ref to="ending-your-account" />). Where the law requires it, or where someone may be at risk, especially a
          child, we may report the matter to the police or other authorities.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services and links",
    body: (
      <>
        <H3>Sign-in providers</H3>
        <p>
          If you sign in with Google, Microsoft or your organisation's single sign-on, that provider handles the sign-in
          under its own terms and privacy policy. If you lose access to that account, contact us and we'll try to help.
        </p>
        <H3>Linked content and other websites</H3>
        <p>
          Content you link to, such as a YouTube video, belongs to its owners and is governed by the platform's own
          terms. We can't promise we'll be able to use it: it may be private, removed or otherwise unavailable. Teach
          mode may also show pictures from other websites to illustrate a lesson, and AnotherNotes may link to other
          sites. We don't control or endorse third-party content, and we aren't responsible for it.
        </p>
        <H3>Service providers, browsers and devices</H3>
        <p>
          We use third-party service providers to help us run AnotherNotes, including AI model providers and
          text-to-speech and voice providers, as our <PrivacyLink /> explains. Some features, such as speech recognition
          and microphone access, rely on your browser or device, which their makers provide under their own terms.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "Our intellectual property and feedback",
    body: (
      <>
        <p>
          AnotherNotes, including its software, design, text, graphics, logos and name, belongs to us or our licensors
          and is protected by intellectual property laws. Your content stays yours (see <Ref to="your-content" />).
        </p>
        <p>
          Subject to these terms, we give you a personal, non-exclusive, non-transferable and revocable licence to use
          AnotherNotes for your own personal, non-commercial learning or, if an organisation provides your account, for
          the purposes it allows. We keep all rights we don't expressly give you. Don't use our name, logo or branding
          without our written permission.
        </p>
        <H3>Feedback</H3>
        <p>
          If you send us ideas or feedback, we may use them for any purpose without paying you or owing you anything.
          Please don't send us anything confidential, or anything you don't have the right to share.
        </p>
      </>
    ),
  },
  {
    id: "copyright",
    title: "Copyright complaints",
    body: (
      <>
        <p>
          If you believe material on AnotherNotes infringes your copyright, email <Mail subject="Copyright complaint" />{" "}
          with "Copyright complaint" in the subject line, and include:
        </p>
        <List ordered>
          <li>a description of the copyright work you believe has been infringed;</li>
          <li>
            a description of the material you believe is infringing, with enough detail for us to find it (for example,
            a link, or where it appears);
          </li>
          <li>your name, postal address, telephone number and email address;</li>
          <li>
            a statement that you believe in good faith that the use of the material isn't authorised by the copyright
            owner, its agent or the law;
          </li>
          <li>
            a statement that the information in your complaint is accurate, and that you're the copyright owner or are
            authorised to act on the owner's behalf; and
          </li>
          <li>your physical or electronic signature (for example, your full name typed at the end of the email).</li>
        </List>
        <p>
          We may remove or disable access to the material, and we'll usually let the person who added it know. If you
          think material you added was removed by mistake, contact us and explain why. We may suspend or close the
          accounts of people who repeatedly infringe other people's rights.
        </p>
        <p>
          Knowingly sending a false complaint may make you legally responsible for the harm it causes. You can also use
          this address to report other illegal content, or infringements of other rights such as trade marks.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    title: "Fees",
    body: (
      <>
        <p>AnotherNotes is free to use while it's in beta. If we introduce paid plans or features:</p>
        <List>
          <li>
            we'll give you at least 30 days' notice before we start charging for anything, and explain the price and
            what's included;
          </li>
          <li>
            we'll never charge you unless you explicitly agree to pay, for example by choosing a paid plan and confirming
            a payment method; and
          </li>
          <li>any paid plan will have its own terms, which we'll show you before you agree to them.</li>
        </List>
        <p>
          If you don't want to pay, you can keep using any features that stay free, or stop using AnotherNotes and ask us
          to delete your account.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    body: (
      <>
        <p>
          Our <PrivacyLink /> explains what personal information we collect, how we use and share it (including with the
          service providers mentioned in these terms) and the rights you have. Please read it alongside these terms.{" "}
          <Ref to="families" /> summarises what a connected parent or guardian can see. If you use AnotherNotes through a
          school or organisation, it may have its own privacy notice too.
        </p>
        <p>
          We take reasonable steps to protect your information, but no online service can be completely secure.
        </p>
      </>
    ),
  },
  {
    id: "ending-your-account",
    title: "Suspension and ending your account",
    body: (
      <>
        <H3>If you want to leave</H3>
        <p>
          You can stop using AnotherNotes at any time. To delete your account, email{" "}
          <Mail subject="Delete my account" /> from the address linked to it; we may ask you to confirm it's really you.
          We'll then delete your content as our <PrivacyLink /> explains, although some information may stay in backups
          for a limited time, or be kept where the law requires it.
        </p>
        <p>
          A parent or guardian can delete a child profile they created, in AnotherNotes or by emailing us. If an
          organisation provides your account, you may need to ask the organisation.
        </p>
        <H3>If we suspend or close your account</H3>
        <p>We may suspend, restrict or close your account if:</p>
        <List>
          <li>you break these terms seriously or repeatedly;</li>
          <li>
            we reasonably believe your use of AnotherNotes creates a risk of harm, legal liability or a security problem
            for anyone, including us;
          </li>
          <li>the law, a court or another authority requires us to; or</li>
          <li>we stop providing AnotherNotes, or the part of it you use.</li>
        </List>
        <p>
          Where it's reasonable, we'll warn you first, explain why and give you a chance to put things right. We may act
          straight away where the problem is serious, where someone's safety or security is at risk, or where the law
          requires it. If we stop providing AnotherNotes altogether, we'll give you reasonable notice where practical, so
          you can keep copies of what you need. If you think we've made a mistake, please contact us.
        </p>
        <H3>What happens next</H3>
        <p>
          When your account ends, so does your right to use AnotherNotes. Parts of these terms meant to continue will
          keep applying, in particular sections <Ref bare to="intellectual-property" />, <Ref bare to="disclaimers" />,{" "}
          <Ref bare to="liability" />, <Ref bare to="indemnity" />, <Ref bare to="governing-law" /> and{" "}
          <Ref bare to="general" />.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to AnotherNotes and these terms",
    body: (
      <>
        <H3>Changes to AnotherNotes</H3>
        <p>
          AnotherNotes is in beta and will keep changing. We may add, change or remove features, or limits on how it can
          be used, at any time. If a change significantly reduces what you can do, we'll try to tell you in advance.
        </p>
        <H3>Changes to these terms</H3>
        <p>
          We may update these terms, for example to reflect changes to AnotherNotes or to the law. If we make a material
          change, we'll tell you in the app or by email at least 14 days before it takes effect (for a child profile, we'll
          tell the parent or guardian who set it up). Changes needed urgently for security or legal reasons may take
          effect sooner, and changes that don't affect your rights, such as corrections, may take effect straight away.
        </p>
        <p>
          The effective date at the top of this page shows when these terms last changed. If you keep using AnotherNotes
          after a change takes effect, the updated terms apply to you. If you don't agree, stop using AnotherNotes and ask
          us to delete your account.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <>
        <p>
          We work hard to make AnotherNotes useful and reliable, but it's a beta service, currently free, and we provide
          it "as is" and "as available". To the fullest extent the law allows, we give no warranties of any kind, express
          or implied, about AnotherNotes or its outputs. In particular, we don't promise that:
        </p>
        <List>
          <li>AnotherNotes will always be available, or work without interruptions, delays or errors;</li>
          <li>outputs will be accurate, complete, up to date or suitable for your purposes;</li>
          <li>AnotherNotes will help you achieve particular results, such as exam grades; or</li>
          <li>your content will never be lost or damaged.</li>
        </List>
        <p>
          To the extent the law allows, we also exclude any implied warranties or conditions of satisfactory quality,
          merchantability, fitness for a particular purpose and non-infringement.
        </p>
        <p>
          <B>Your consumer rights.</B> Nothing in these terms affects your legal rights as a consumer that can't be
          excluded or limited by contract, so some of these exclusions may not apply to you.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <H3>What we don't limit</H3>
        <p>Nothing in these terms limits or excludes our liability for:</p>
        <List>
          <li>death or personal injury caused by our negligence;</li>
          <li>fraud or fraudulent misrepresentation; or</li>
          <li>anything else that can't be limited or excluded by law.</li>
        </List>
        <p>Nothing in these terms affects your statutory rights as a consumer.</p>
        <H3>What we do limit</H3>
        <p>Subject to the paragraphs above, and to the fullest extent the law allows:</p>
        <List>
          <li>
            we aren't liable for any indirect, incidental, special, consequential or punitive loss or damage, or for any
            loss of profits, revenue, business, goodwill, opportunity or data;
          </li>
          <li>
            we aren't liable for loss or damage that wasn't reasonably foreseeable when you accepted these terms, or
            that's caused by events outside our reasonable control; and
          </li>
          <li>
            our total liability to you for all claims arising out of or in connection with these terms or AnotherNotes
            is limited to the greater of (a) the amount you paid us for AnotherNotes in the 12 months before the event
            giving rise to the claim, and (b) 100 US dollars, or the equivalent in your local currency.
          </li>
        </List>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: (
      <>
        <p>
          This section applies only to adults and organisations using AnotherNotes. It never applies to children, and it
          applies to consumers only as far as the law where they live allows.
        </p>
        <p>
          You agree to indemnify (that is, compensate) us and our directors, employees and agents for any claims,
          losses, liabilities, damages, costs and expenses (including reasonable legal fees) arising from a claim by
          someone else that is caused by:
        </p>
        <List>
          <li>content you add to AnotherNotes;</li>
          <li>your breach of these terms; or</li>
          <li>your breach of the law or of someone else's rights.</li>
        </List>
        <p>
          This covers only your own content and conduct (or, for an organisation, its own), and not any part of a loss
          that we caused. We'll tell you promptly about any claim this section covers.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law and disputes",
    body: (
      <>
        <H3>Talk to us first</H3>
        <p>
          If something goes wrong, please email us first at <Mail /> and tell us what happened and what you'd like us to
          do. We'll try in good faith to sort it out informally.
        </p>
        <H3>Law and courts</H3>
        <p>
          These terms, and any dispute or claim arising out of or in connection with them or AnotherNotes (including
          non-contractual disputes or claims), are governed by the laws of <Fill>{LEGAL.governingLaw}</Fill>.
        </p>
        <p>
          If you're a consumer, you keep the protection of the mandatory laws of the country where you live, and you can
          bring a claim in your local courts (for example, if you live in the UK or the European Union) or in the courts
          of <Fill>{LEGAL.governingLaw}</Fill>. If you use AnotherNotes on behalf of an organisation, the courts of{" "}
          <Fill>{LEGAL.governingLaw}</Fill> have exclusive jurisdiction.
        </p>
      </>
    ),
  },
  {
    id: "general",
    title: "General",
    body: (
      <>
        <p>
          <B>Entire agreement.</B> These terms, with any extra terms we show you for specific features, are the whole
          agreement between you and us about AnotherNotes, and replace any earlier agreement on the same subject. For
          accounts provided by an organisation, see also <Ref to="organisations" />.
        </p>
        <p>
          <B>Notices.</B> We may send you notices in AnotherNotes or by email to the address linked to your account (for
          a child profile, to the parent or guardian who set it up). You can send notices to us at <Mail />.
        </p>
        <p>
          <B>Severability.</B> If a court finds any part of these terms invalid or unenforceable, the rest stays in
          force, and that part will be applied as closely as possible to what it was meant to do.
        </p>
        <p>
          <B>No waiver.</B> If we don't enforce one of these terms straight away, we can still enforce it later.
        </p>
        <p>
          <B>Transfers.</B> You can't transfer your rights or obligations under these terms without our written
          agreement. We may transfer ours, for example if AnotherNotes is sold or reorganised. If we do, we'll tell you,
          and it won't affect your rights under these terms.
        </p>
        <p>
          <B>No third-party rights.</B> Only you and we can enforce these terms.
        </p>
        <p>
          <B>Headings and the summary.</B> Headings, and the short version at the top of this page, are there to help you
          find your way and don't affect the meaning of these terms. Words such as "including" and "for example" don't
          limit what comes before them.
        </p>
        <p>
          <B>Language.</B> These terms are written in English. If we provide a translation, the English version applies
          if the two differ, unless the law requires otherwise.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        <p>If you have questions about these terms, we're happy to help.</p>
        <ContactDetails />
        <p>
          You can also reach us through our{" "}
          <Link to="/contact" className={linkClass}>
            contact page
          </Link>
          .
        </p>
      </>
    ),
  },
];

/* ---------- page ---------- */

const TermsPage = () => (
  <LegalDocument
    title="Terms of Service"
    effective={EFFECTIVE}
    intro="The rules for using AnotherNotes: what you can expect from us, and what we expect from you. Please read them carefully, and if you're under 18, read them with a parent or guardian."
    summary={SUMMARY}
    summaryNote="This summary is only here to help you find your way. It isn't part of the terms: the full terms below are what apply."
    sections={SECTIONS}
    skipLabel="Skip to the terms"
    current="/terms"
  />
);

export default TermsPage;
