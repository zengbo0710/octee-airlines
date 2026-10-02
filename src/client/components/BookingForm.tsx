import { useState, type FormEvent } from "react";
import { api, errorMessage, jsonPost } from "../lib/api";
import type { Booking, Journey, User } from "../types";

interface BookingFormProps {
  journey: Journey;
  passengers: number;
  user: User | null;
  onCancel: () => void;
  onNeedLogin: () => void;
  onConfirmed: (booking: Booking) => void;
}

interface BookingResult {
  booking: Booking;
  milesEarned: number;
}

export function BookingForm({ journey, passengers, user, onCancel, onNeedLogin, onConfirmed }: BookingFormProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setMessage("Log in or sign up to confirm and save this trip.");
      onNeedLogin();
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      passengerName: String(formData.get("passengerName") || ""),
      aircraft: String(formData.get("aircraft") || ""),
      cabinClass: String(formData.get("cabinClass") || ""),
      seatPreference: String(formData.get("seatPreference") || ""),
      snackPreference: String(formData.get("snackPreference") || ""),
      bags: Number(formData.get("bags")),
      reason: String(formData.get("reason") || ""),
      joelmobile: formData.get("joelmobile") === "on",
      terms: formData.getAll("terms").map(String),
      date: journey.date,
      requestKey: journey.requestKey,
      from: journey.from,
      to: journey.to,
      passengers,
      flightIds: journey.legs.map((leg) => leg.flightId),
    };
    setSubmitting(true);
    setMessage("Reserving shared seats…");
    try {
      const result = await api<BookingResult>("/api/bookings", jsonPost(payload));
      onConfirmed(result.booking);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="booking-form grid gap-4" onSubmit={submit}>
      <div className="selected-itinerary">
        <h3>{journey.from} → {journey.to} · {journey.date}</h3>
        {journey.legs.map((leg) => (
          <p key={`${leg.flightId}-${leg.from}-${leg.to}`}>
            {leg.flightNo} · {leg.from} {leg.departTime} → {leg.to} {leg.arriveTime}{leg.airline === "SA" ? " · Partner flight simulation" : ""}
          </p>
        ))}
        <small className="fine-print">{passengers} passenger(s). The seats are shared by all visitors.</small>
      </div>
      <div className="form-grid">
        <label>Passenger name<input name="passengerName" defaultValue={user?.username || ""} minLength={2} maxLength={80} required autoComplete="name" /></label>
        <label>Aircraft<select name="aircraft"><option>Airbus 777</option><option>Boeing 330</option><option>Airbus 747</option><option>Boeing 380</option><option>Surprise me</option></select></label>
        <label>Cabin<select name="cabinClass"><option>Octee Economy</option><option>Octee Business</option><option>Octee First</option></select></label>
        <label>Seat<select name="seatPreference"><option>Somewhere</option><option>Window</option><option>Aisle</option></select></label>
        <label>Snack<select name="snackPreference"><option>One Peanut</option><option>One Peanut (vegetarian)</option><option>One Peanut (served warm)</option></select></label>
        <label>Bags<select name="bags"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
        <label className="span-all">Reason for travelling<select name="reason"><option>Adventure</option><option>Business, supposedly</option><option>Visiting someone who said “it’s fine”</option><option>To see if the plane works</option></select></label>
      </div>
      <label className="check-row"><input name="joelmobile" type="checkbox" /> Request a JOELMOBILE pickup at my gate (+20 Octmiles if eligible)</label>
      <fieldset className="terms">
        <legend>Three small acknowledgements</legend>
        <label className="check-row"><input name="terms" type="checkbox" value="ceo" required /> I accept Octee to be CEO</label>
        <label className="check-row"><input name="terms" type="checkbox" value="engines" required /> I accept that the engines MAY be working</label>
        <label className="check-row"><input name="terms" type="checkbox" value="luggage" required /> FIA and SIA are not responsible for loss of luggage</label>
      </fieldset>
      <div className="form-actions">
        <button className="button button-quiet" type="button" onClick={onCancel}>Choose another flight</button>
        <button className="button" type="submit" disabled={submitting}>{submitting ? "Reserving…" : "Confirm — no money will be taken"}</button>
      </div>
      <p className="status-message" role="status">{message}</p>
    </form>
  );
}
