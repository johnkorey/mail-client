import { graphFetch } from "./graphClient";
import type { Event } from "../types/graph";

export async function getEvents(
  startDateTime: string,
  endDateTime: string
): Promise<Event[]> {
  const response = await graphFetch("me/calendarView", {
    params: {
      startDateTime,
      endDateTime,
      $select:
        "id,subject,start,end,location,organizer,isAllDay,bodyPreview,attendees,onlineMeeting",
      $orderby: "start/dateTime",
      $top: "100",
    },
  });
  return response.value;
}

export async function getEvent(eventId: string): Promise<Event> {
  return graphFetch(`me/events/${eventId}`);
}

export async function createEvent(event: Partial<Event>): Promise<Event> {
  return graphFetch("me/events", {
    method: "POST",
    body: event,
  });
}

export async function updateEvent(
  eventId: string,
  updates: Partial<Event>
): Promise<Event> {
  return graphFetch(`me/events/${eventId}`, {
    method: "PATCH",
    body: updates,
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await graphFetch(`me/events/${eventId}`, { method: "DELETE" });
}

export async function acceptEvent(eventId: string): Promise<void> {
  await graphFetch(`me/events/${eventId}/accept`, {
    method: "POST",
    body: { sendResponse: true },
  });
}

export async function declineEvent(eventId: string): Promise<void> {
  await graphFetch(`me/events/${eventId}/decline`, {
    method: "POST",
    body: { sendResponse: true },
  });
}

export async function tentativelyAcceptEvent(
  eventId: string
): Promise<void> {
  await graphFetch(`me/events/${eventId}/tentativelyAccept`, {
    method: "POST",
    body: { sendResponse: true },
  });
}
