// Also referenced as SUPPORT_EMAIL in supabase/functions/send-auth-email.
const CONTACT_EMAIL = 'support@dinkmanager.com';

export function ContactEmail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-700 hover:underline">
      {CONTACT_EMAIL}
    </a>
  );
}

export function Bullets({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
