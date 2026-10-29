/**
 * The home page's closing sections: short centered texts about Apotek
 * Inofarma and a contact block. All of it is edited in the admin under
 * Konten Website > Beranda; only the two contact icons are drawn here.
 */
function PhoneIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M17 15l-3 3-8-8 3-3-5-5-3 3c0 9.941 8.059 18 18 18l3-3-5-5z" stroke="#0900aa" strokeWidth="1.5" strokeLinecap="square" />
            <path d="M14 1c4.971 0 9 4.029 9 9m-9-5c2.761 0 5 2.239 5 5" stroke="#24ce30" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
    );
}

function EmailIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M.916667 10.08333367l3.66666667-2.65833334v4.65849997zm20.1666667 0L17.416667 7.42500033v4.65849997z" stroke="#24ce30" />
            <path d="M4.58333367 7.42500033L.916667 10.08333367V21.0833337h20.1666667V10.08333367L17.416667 7.42500033" stroke="#0900aa" strokeWidth="1.5" />
            <path d="M4.58333367 12.1000003V.916667H17.416667v11.1833333m-16.5-2.01666663L21.0833337 21.0833337m0-11.00000003L11.0000003 15.5833337" stroke="#0900aa" strokeWidth="1.5" />
            <path d="M8.25000033 5.50000033h5.49999997M8.25000033 9.166667h5.49999997" stroke="#24ce30" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
    );
}

const CONTACT_ICONS = { phone: <PhoneIcon />, email: <EmailIcon /> };

export default function HomeInfo({ content, className = 'px-3.5' }: {
  content: Pick<HomeContent, 'texts' | 'contactTitle' | 'contactIntro' | 'contacts'>,
  className?: string,
}) {
    return (
        <div className={`${className} mx-auto max-w-[760px] text-center`}>
            {content.texts.map((text, index) => (
                <section key={`${index}-${text.title}`} className="mt-8">
                    <h2 className="font-display text-[18px] leading-snug text-brand lg:text-[24px]">{text.title}</h2>
                    {text.paragraphs.map((paragraph, paragraphIndex) => (
                        <p key={paragraphIndex} className="mt-3 text-[12.5px] leading-relaxed text-muted lg:text-[14px]">
                            {paragraph}
                        </p>
                    ))}
                </section>
            ))}

            <section className="mt-10">
                <h2 className="font-display text-[18px] leading-snug text-brand lg:text-[24px]">{content.contactTitle}</h2>
                {content.contactIntro ? (
                    <p className="mt-3 text-[12.5px] leading-relaxed text-muted lg:text-[14px]">
                        {content.contactIntro}
                    </p>
                ) : null}

                <div className="mt-5 grid gap-3 text-left lg:grid-cols-2 lg:gap-4">
                    {content.contacts.map((contact, index) => (
                        <div key={`${index}-${contact.title}`} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
                            <span className="mt-0.5 shrink-0">{CONTACT_ICONS[contact.icon]}</span>
                            <div>
                                <p className="text-[13px] font-bold text-ink">{contact.title}</p>
                                {contact.lines.map((line, lineIndex) => (
                                    <p key={lineIndex} className="mt-1 text-[12.5px] text-muted">{line}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
