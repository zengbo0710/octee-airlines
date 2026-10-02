import type { Journey } from "../types";

interface FlightCardProps {
  journey: Journey;
  onChoose: (journey: Journey) => void;
}

export function FlightCard({ journey, onChoose }: FlightCardProps) {
  return (
    <article className="flight-card transition-transform duration-150 hover:-translate-y-0.5">
      <header>
        <h3>{journey.legs.length === 1 ? journey.legs[0].flightNo : `${journey.legs.length} flights · connection`}</h3>
        {journey.legs.map((leg) => (
          <span key={`${leg.flightId}-${leg.from}-${leg.to}`} className={`airline-tag ${leg.airline}`}>
            {leg.airline === "SA" ? "SA · PARTNER SIMULATION" : leg.airline}
          </span>
        ))}
      </header>
      {journey.legs.map((leg) => (
        <div className="flight-route" key={`${leg.flightId}-${leg.from}-${leg.to}`}>
          <strong>{leg.from}</strong>
          <span>{leg.flightNo} · {leg.departTime} → {leg.arriveTime}{leg.stops.length ? ` · via ${leg.stops.join(", ")}` : ""}</span>
          <strong>{leg.to}</strong>
        </div>
      ))}
      <div className="flight-meta">
        <span>{journey.availableSeats} seats remaining · {journey.date} · Singapore time</span>
        <button className="button" type="button" onClick={() => onChoose(journey)}>Choose flight</button>
      </div>
    </article>
  );
}
