export interface Airport {
  code: string;
  name: string;
  description: string;
  aliases: string[];
}

export interface User {
  id: string;
  username: string;
  role: "passenger" | "admin" | "owner";
  octmiles_balance: number;
  octmiles_lifetime: number;
  created_at: string;
}

export interface JourneyLeg {
  flightId: string;
  flightNo: string;
  airline: "OA" | "OU" | "SA";
  from: string;
  to: string;
  departTime: string;
  arriveTime: string;
  departAt: string;
  arriveAt: string;
  stops: string[];
  availableSeats: number;
}

export interface Journey {
  date: string;
  from: string;
  to: string;
  availableSeats: number;
  legs: JourneyLeg[];
  requestKey?: string;
}

export interface Departure {
  flight: string;
  airline: "OA" | "OU" | "SA";
  destination: string;
  scheduled: string;
  status: string;
}

export interface Review {
  id: string;
  rating: number;
  title: string;
  body: string;
  route: string | null;
  verified_flyer: number;
  created_at: string;
  username: string;
}

export interface BookingLeg {
  flight_no: string;
  airline: string;
  from_code: string;
  to_code: string;
  depart_time: string;
  arrive_time: string;
  leg_order?: number;
}

export interface Booking {
  id: string;
  reference: string;
  trip_date: string;
  origin_code: string;
  destination_code: string;
  passenger_name: string;
  passenger_count: number;
  aircraft: string;
  cabin_class: string;
  octmiles_earned: number;
  legs: BookingLeg[];
}

export interface ApiErrorBody {
  error?: string;
}
