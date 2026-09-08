import { airportNameEn, airportNameVi } from './airports';

interface Airport {
  code: string;
  name: string;
}

interface JourneyPoint {
  localScheduledTime: string; // "2026-09-22 08:40:00"
  airport: Airport;
}

interface Segment {
  flight: {
    airlineCode: { code: string };
    flightNumber: string;
  };
  arrival: JourneyPoint;
}

interface Journey {
  departure: JourneyPoint;
  segments: Segment[];
}

interface Passenger {
  reservationProfile: { lastName: string; firstName: string };
}

export interface Reservation {
  locator: string;
  passengers: Passenger[];
  journeys: Journey[];
}

export type FormatStyle = 'en' | 'vi-short' | 'en-long';

function splitDateTime(localScheduledTime: string): { date: string; time: string } {
  const [datePart, timePart] = localScheduledTime.split(' ');
  const [y, m, d] = datePart.split('-');
  return { date: `${d}/${m}/${y}`, time: timePart.slice(0, 5) };
}

function flightNumber(seg: Segment): string {
  return `${seg.flight.airlineCode.code}${seg.flight.flightNumber}`;
}

export function formatBooking(reservation: Reservation, style: FormatStyle): string {
  const names = reservation.passengers.map(
    (p) => `${p.reservationProfile.lastName} ${p.reservationProfile.firstName}`
  );

  if (style === 'en') {
    const legs = reservation.journeys.map((j) => {
      const seg = j.segments[0];
      const dep = splitDateTime(j.departure.localScheduledTime);
      const arr = splitDateTime(seg.arrival.localScheduledTime);
      const from = airportNameEn(j.departure.airport.code, j.departure.airport.name);
      const to = airportNameEn(seg.arrival.airport.code, seg.arrival.airport.name);
      return [
        `Route: ${from} - ${to}`,
        `Depart date: ${dep.date}`,
        `Flight time: ${dep.time} - ${arr.time}`,
        `Flight number: ${flightNumber(seg)}`,
        `Airline: Vietjet Air`,
      ].join('\n');
    });

    return [`Code: ${reservation.locator}`, `Hành khách: ${names.join(' ')}`, '', legs.join('\n---\n')].join('\n');
  }

  if (style === 'vi-short') {
    const legLines = reservation.journeys.map((j) => {
      const seg = j.segments[0];
      const dep = splitDateTime(j.departure.localScheduledTime);
      const from = airportNameVi(j.departure.airport.code, j.departure.airport.name);
      const to = airportNameVi(seg.arrival.airport.code, seg.arrival.airport.name);
      return `Chuyến bay ${flightNumber(seg)}: từ ${from} đến ${to} ngày ${dep.date} lúc ${dep.time},`;
    });

    return [`Code: ${reservation.locator}`, `Hành khách:`, ...names, ...legLines, `Hãng Vietjetair,`].join('\n');
  }

  // style === 'en-long': same layout as 'vi-short', English wording + English airport names
  const legLines = reservation.journeys.map((j) => {
    const seg = j.segments[0];
    const dep = splitDateTime(j.departure.localScheduledTime);
    const from = airportNameEn(j.departure.airport.code, j.departure.airport.name);
    const to = airportNameEn(seg.arrival.airport.code, seg.arrival.airport.name);
    return `Flight ${flightNumber(seg)}: from ${from} to ${to} on ${dep.date} at ${dep.time},`;
  });

  return [`Code: ${reservation.locator}`, `Passengers:`, ...names, ...legLines, `Airline: Vietjetair,`].join('\n');
}
