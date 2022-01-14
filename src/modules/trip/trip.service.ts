import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { InsertResult, Repository } from 'typeorm';
import { Trip } from './trip.entity';
import * as dotenv from 'dotenv';
import { WeeklyStatsDTO } from '../stats/dto/stats.dto';
dotenv.config();

@Injectable()
export class TripService {
  constructor(
    @Inject('TRIP_REPOSITORY')
    private tripRepository: Repository<Trip>,
  ) {}

  async createNewTrip(trip: Trip): Promise<InsertResult> {
    const params = {
      destination: trip.start_address,
      origin: trip.end_address,
      key: process.env['GOOGLE_MAPS_API_KEY'],
      mode: 'bicycling',
    };
    const queryString = new URLSearchParams(params).toString();
    const result = await axios.get(
      `https://maps.googleapis.com/maps/api/directions/json?${queryString}`,
    );
    if (result.data.status !== 'OK') {
      throw new BadRequestException("Can't find the route");
    }

    const distance = result.data.routes[0].legs[0].distance.value;
    // convert distance from meters to kilometes
    const distanceInKm = Math.round((distance / 1000) * 10) / 10;

    const newTrip = {
      ...trip,
      date: new Date(trip.date),
      distance: distanceInKm,
    };
    return this.tripRepository.insert(newTrip);
  }

  async getWeeklyTrips(): Promise<WeeklyStatsDTO> {
    const trips = await this.tripRepository.find();
    // return trips from yesterday to 7 days ago
    // does not include today, so we need to add 1 day
    // to get the correct end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 8);

    let sum_distane = 0;
    let sum_price = 0;

    const tripsInPeriod = trips.filter((trip) => {
      const tripDate = new Date(trip.date);
      return tripDate >= startDate && tripDate <= endDate;
    });

    tripsInPeriod.forEach((trip) => {
      // convert distance from string to int
      sum_distane += Number(trip.distance);
      sum_price += trip.price;
    });

    return {
      total_distance: sum_distane + 'km',
      total_price: sum_price + 'PLN',
    };
  }
}
