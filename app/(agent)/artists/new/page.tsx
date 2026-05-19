import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { requireServerEnv } from "@/lib/env";
import { randomToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

async function createArtist(formData: FormData) {
  "use server";
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone_e164") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!fullName) {
    throw new Error("Name is required");
  }
  // Phone format: E.164, e.g. +15551234567. Optional for now.
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error("Phone must be E.164 format, e.g. +15551234567");
  }

  const agencyId = requireServerEnv("AGENCY_ID");
  const sb = serviceClient();
  const inviteToken = randomToken(24);

  const { error } = await sb.from("artists").insert({
    agency_id: agencyId,
    full_name: fullName,
    phone_e164: phone || null,
    email: email || null,
    invite_token: inviteToken,
    status: "invited",
  });
  if (error) throw new Error(`Insert failed: ${error.message}`);

  redirect("/artists");
}

export default function NewArtistPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Invite an artist</h1>
      <form action={createArtist} className="space-y-4">
        <Field label="Full name" name="full_name" required />
        <Field
          label="Phone (E.164, +15551234567)"
          name="phone_e164"
          placeholder="+15551234567"
        />
        <Field label="Email" name="email" type="email" />
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create + generate invite link
          </button>
          <a
            href="/artists"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Cancel
          </a>
        </div>
      </form>
      <p className="mt-6 text-xs text-neutral-500">
        After saving, copy the invite link from the artists table and send it to the artist. They click,
        sign into Google, grant <code>calendar.freebusy</code> access — done. You then copy the resulting
        iCal URL and paste it into Overture once.
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-neutral-300">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
