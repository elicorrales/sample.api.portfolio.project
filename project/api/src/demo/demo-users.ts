import type { z } from "zod";
import type { userInputSchema } from "../users/users.schema.ts";

// What a client would send to create a user, before validation turns phone numbers into +1XXXXXXXXXX.
type UserRequestBody = z.input<typeof userInputSchema>;

// The hosted demo's 50 starting users. All fake: emails at example.com (reserved for examples) and phone numbers
// in 555-0100 to 555-0199 (reserved for fiction). Built in a fixed order, so every reset brings back the same people.
// Chosen to make the demo worth trying: shared last names (sorting ties), names with hyphens, periods, and
// apostrophes, 1 to 3 phones and addresses, a few formats of phone number, and 5 users already deleted.
// Each one must pass the same validation as a real create (tests/integrity/demo-data.test.ts).

const FIRST_NAMES = [
  "Ava", "Liam", "Emma", "Noah", "Olivia", "James", "Sophia", "Lucas", "Mia", "Ethan",
  "Isabella", "Mason", "Amelia", "Logan", "Harper", "Elijah", "Evelyn", "Aiden", "Abigail", "Jackson",
  "Emily", "Carter", "Ella", "Owen", "Grace", "Wyatt", "Chloe", "Henry", "Zoey", "Levi",
  "Nora", "Julian", "Lily", "Hudson", "Hazel", "Gavin", "Aria", "Miles", "Layla", "Jonah",
  "Stella", "Caleb", "Violet", "Isaac", "Aurora", "Ryan", "Naomi", "Adrian", "Ruby", "Mateo",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Smith", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis",
  "O'Brien", "Robinson", "Walker", "Young", "Allen", "King", "Smith-Jones", "Wright", "Scott", "Torres",
  "Nguyen", "Hill", "Flores", "Green", "St. Clair", "Adams", "Nelson", "Baker", "Johnson", "Hall",
];

const PLACES = [
  { city: "Miami", state: "FL", zip: "33101", areaCode: "305" },
  { city: "New York", state: "NY", zip: "10001", areaCode: "212" },
  { city: "Chicago", state: "IL", zip: "60601", areaCode: "312" },
  { city: "San Francisco", state: "CA", zip: "94103", areaCode: "415" },
  { city: "Boston", state: "MA", zip: "02108", areaCode: "617" },
  { city: "Houston", state: "TX", zip: "77002", areaCode: "713" },
  { city: "Seattle", state: "WA", zip: "98101", areaCode: "206" },
  { city: "Denver", state: "CO", zip: "80202", areaCode: "303" },
  { city: "Atlanta", state: "GA", zip: "30303", areaCode: "404" },
  { city: "Phoenix", state: "AZ", zip: "85004", areaCode: "602" },
] as const;

const STREETS = ["Maple Ave", "Oak St", "Pine Rd", "Cedar Ln", "Elm St", "Birch Blvd", "Lake Dr", "Hill St", "Park Ave", "River Rd"];
const PHONE_TYPES = ["mobile", "home", "work"] as const;
const ADDRESS_TYPES = ["home", "work", "mailing"] as const;
const DELETED = new Set([7, 17, 27, 37, 47]);

const pad = (value: number, width: number) => String(value).padStart(width, "0");

function demoUser(i: number): UserRequestBody {
  const firstName = FIRST_NAMES[i];
  const lastName = LAST_NAMES[i];
  const place = PLACES[i % PLACES.length];

  const phones = PHONE_TYPES.slice(0, 1 + (i % 3)).map((type, j) => {
    const line = `01${pad((i * 3 + j) % 100, 2)}`;
    // A few of the formats the API accepts; it stores all of them as +1XXXXXXXXXX.
    const formats = [`(${place.areaCode}) 555-${line}`, `${place.areaCode}-555-${line}`, `${place.areaCode}555${line}`];
    return { number: formats[(i + j) % formats.length], type, primary: j === 0 };
  });

  const addresses = ADDRESS_TYPES.slice(0, 1 + ((i + 1) % 3)).map((type, j) => ({
    street: `${100 + i * 7 + j} ${STREETS[(i + j) % STREETS.length]}`,
    ...(i % 4 === 0 && j === 0 && { street2: `Apt ${1 + (i % 9)}B` }),
    city: place.city,
    state: place.state,
    zip: place.zip,
    type,
    primary: j === 0,
  }));

  return {
    firstName,
    lastName,
    email: `${firstName}.${lastName}@example.com`.toLowerCase().replace(/[^a-z.@]/g, ""),
    dateOfBirth: `${1950 + ((i * 7) % 55)}-${pad(1 + ((i * 5) % 12), 2)}-${pad(1 + ((i * 3) % 28), 2)}`,
    phones,
    addresses,
  };
}

export const DEMO_USERS = FIRST_NAMES.map((_, i) => ({ input: demoUser(i), deleted: DELETED.has(i) }));
