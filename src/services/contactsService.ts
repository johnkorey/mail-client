import { graphFetch } from "./graphClient";
import type { Contact, GraphPagedResponse } from "../types/graph";

export async function getContacts(
  top: number = 50,
  skip: number = 0
): Promise<GraphPagedResponse<Contact>> {
  return graphFetch("me/contacts", {
    params: {
      $top: String(top),
      $skip: String(skip),
      $orderby: "displayName",
    },
  });
}

export async function getContact(contactId: string): Promise<Contact> {
  return graphFetch(`me/contacts/${contactId}`);
}

export async function createContact(
  contact: Partial<Contact>
): Promise<Contact> {
  return graphFetch("me/contacts", {
    method: "POST",
    body: contact,
  });
}

export async function updateContact(
  contactId: string,
  updates: Partial<Contact>
): Promise<Contact> {
  return graphFetch(`me/contacts/${contactId}`, {
    method: "PATCH",
    body: updates,
  });
}

export async function deleteContact(contactId: string): Promise<void> {
  await graphFetch(`me/contacts/${contactId}`, { method: "DELETE" });
}

export async function searchPeople(query: string) {
  const response = await graphFetch("me/people", {
    params: { $search: query, $top: "10" },
  });
  return response.value;
}
