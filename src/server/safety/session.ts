/**
 * "Who is using this phone" for the safety section.
 *
 * NOTE: this is a name picker stored in a cookie, not a login. It records who
 * did what, but anyone with the link can pick any name. Replace with real
 * sign-in (mobile number + texted code) before relying on it as evidence.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPerson } from "./repo";
import type { Person } from "@/lib/safety/types";

export const PERSON_COOKIE = "safety_person";

export async function currentPerson(): Promise<Person | null> {
  const id = (await cookies()).get(PERSON_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const person = await getPerson(id);
  return person?.active ? person : null;
}

/** For pages: send the visitor to the name picker if we don't know them. */
export async function requirePerson(): Promise<Person> {
  const person = await currentPerson();
  if (!person) redirect("/safety/who");
  return person;
}
