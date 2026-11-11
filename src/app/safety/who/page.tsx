import { LOCATIONS } from "@/config/team";
import { listPeople } from "@/server/safety/repo";
import { currentPerson } from "@/server/safety/session";
import { Screen } from "@/components/safety/ui";
import { WhoPicker } from "@/components/safety/WhoPicker";

export default async function WhoPage() {
  const [people, me] = await Promise.all([listPeople(), currentPerson()]);
  return (
    <Screen title={people.length ? "Who's using this phone?" : "Welcome"}>
      <WhoPicker
        people={people}
        locations={LOCATIONS.map((l) => ({ id: l.id, name: l.name }))}
        currentId={me?.id ?? null}
      />
    </Screen>
  );
}
