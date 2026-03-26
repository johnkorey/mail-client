import { useState, useMemo } from "react";
import { format, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { useCalendarEvents, useCreateEvent, useDeleteEvent } from "../../hooks/useGraphQuery";
import type { Event } from "../../types/graph";

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState({
    subject: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endDate: format(new Date(), "yyyy-MM-dd"),
    endTime: "10:00",
    location: "",
    body: "",
  });

  const startDateTime = startOfDay(currentDate).toISOString();
  const endDateTime = endOfDay(currentDate).toISOString();

  const { data: events, isLoading } = useCalendarEvents(startDateTime, endDateTime);
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  const getEventPosition = (event: Event) => {
    const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
    const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    if (!start || !end) return null;
    return {
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: end.getHours() + end.getMinutes() / 60,
    };
  };

  const handleCreate = async () => {
    if (!newEvent.subject) return;
    try {
      await createEvent.mutateAsync({
        subject: newEvent.subject,
        start: {
          dateTime: `${newEvent.startDate}T${newEvent.startTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: `${newEvent.endDate}T${newEvent.endTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        location: newEvent.location ? { displayName: newEvent.location } : undefined,
        body: newEvent.body
          ? { contentType: "html", content: newEvent.body }
          : undefined,
      });
      setShowCreate(false);
      setNewEvent({
        subject: "",
        startDate: format(currentDate, "yyyy-MM-dd"),
        startTime: "09:00",
        endDate: format(currentDate, "yyyy-MM-dd"),
        endTime: "10:00",
        location: "",
        body: "",
      });
    } catch (error) {
      console.error("Failed to create event:", error);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (confirm("Delete this event?")) {
      await deleteEvent.mutateAsync(eventId);
      setSelectedEvent(null);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Calendar day view */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Date navigation */}
        <div className="mail-list-header">
          <button className="btn-icon" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
            ←
          </button>
          <h2>{format(currentDate, "EEEE, MMMM d, yyyy")}</h2>
          <button className="btn-icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
            →
          </button>
          <button className="btn" onClick={() => setCurrentDate(new Date())}>
            Today
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Event
          </button>
        </div>

        {isLoading ? (
          <div className="loading-spinner" />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
            <div className="calendar-grid">
              {hours.map((hour) => {
                const hourEvents = events?.filter((e) => {
                  const pos = getEventPosition(e);
                  return pos && Math.floor(pos.startHour) === hour;
                });

                return (
                  <div key={hour} style={{ display: "contents" }}>
                    <div className="calendar-time">
                      {format(new Date(2000, 0, 1, hour), "h a")}
                    </div>
                    <div className="calendar-slot">
                      {hourEvents?.map((event) => (
                        <div
                          key={event.id}
                          className="calendar-event"
                          onClick={() => setSelectedEvent(event)}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="calendar-event-title">
                            {event.subject}
                          </div>
                          <div className="calendar-event-time">
                            {event.start?.dateTime &&
                              format(new Date(event.start.dateTime), "h:mm a")}{" "}
                            -{" "}
                            {event.end?.dateTime &&
                              format(new Date(event.end.dateTime), "h:mm a")}
                          </div>
                          {event.location?.displayName && (
                            <div className="calendar-event-time">
                              📍 {event.location.displayName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Side panel: event detail or create form */}
      {(selectedEvent || showCreate) && (
        <div
          style={{
            width: 360,
            borderLeft: "1px solid var(--color-border)",
            padding: 20,
            overflowY: "auto",
          }}
        >
          {showCreate ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h3>New Event</h3>
                <button className="btn-icon" onClick={() => setShowCreate(false)}>✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  placeholder="Event title"
                  value={newEvent.subject}
                  onChange={(e) => setNewEvent({ ...newEvent, subject: e.target.value })}
                  style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="date"
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                    style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
                  />
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    style={{ width: 120, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="date"
                    value={newEvent.endDate}
                    onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
                  />
                  <input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    style={{ width: 120, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
                  />
                </div>
                <input
                  placeholder="Location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}
                />
                <textarea
                  placeholder="Description"
                  value={newEvent.body}
                  onChange={(e) => setNewEvent({ ...newEvent, body: e.target.value })}
                  rows={3}
                  style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleCreate}>
                    Create
                  </button>
                  <button className="btn" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : selectedEvent ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h3>{selectedEvent.subject}</h3>
                <button className="btn-icon" onClick={() => setSelectedEvent(null)}>✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>When</div>
                  <div>
                    {selectedEvent.start?.dateTime &&
                      format(new Date(selectedEvent.start.dateTime), "EEEE, MMM d, h:mm a")}{" "}
                    -{" "}
                    {selectedEvent.end?.dateTime &&
                      format(new Date(selectedEvent.end.dateTime), "h:mm a")}
                  </div>
                </div>
                {selectedEvent.location?.displayName && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Where</div>
                    <div>📍 {selectedEvent.location.displayName}</div>
                  </div>
                )}
                {selectedEvent.organizer && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Organizer</div>
                    <div>{selectedEvent.organizer.emailAddress?.name}</div>
                  </div>
                )}
                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Attendees</div>
                    {selectedEvent.attendees.map((a, i) => (
                      <div key={i} style={{ fontSize: 13 }}>
                        {a.emailAddress?.name || a.emailAddress?.address}
                      </div>
                    ))}
                  </div>
                )}
                {selectedEvent.bodyPreview && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Description</div>
                    <div style={{ fontSize: 13 }}>{selectedEvent.bodyPreview}</div>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn btn-danger"
                    onClick={() => selectedEvent.id && handleDelete(selectedEvent.id)}
                  >
                    Delete Event
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
