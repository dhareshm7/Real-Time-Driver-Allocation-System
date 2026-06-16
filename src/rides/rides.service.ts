import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Op } from 'sequelize';
import { Customer } from '../models/customer.model';
import { Ride } from '../models/ride.model';
import { RedisService } from '../redis/redis.service';
import { RideDriverDetails } from '../models/ride_driver_details.model';

@Injectable()
export class RidesService {
  constructor(private readonly redisService: RedisService) {}
  async createRide(
    customerId: string,
    pickupLat: number,
    pickupLng: number,
    dropLat: number,
    dropLng: number,
  ) {
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const ride = await Ride.create({
      customer_id: customerId,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      drop_lat: dropLat,
      drop_lng: dropLng,
      status: 'REQUESTED',
    });

    await ride.update({
      status: 'SEARCHING',
    });

    const onlineNearbyDrivers = await this.redisService.findNearbyDrivers(
      pickupLat,
      pickupLng,
    );

    const rideId = ride.getDataValue('id') as string;
    for (const driverId of onlineNearbyDrivers) {
      const expiryTime = new Date();
      expiryTime.setSeconds(expiryTime.getSeconds() + 30);
      await RideDriverDetails.create({
        ride_id: rideId,
        driver_id: driverId,
        status: 'PENDING',
        attempt_number: 1,
        expiry_at: expiryTime,
      });
    }

    // AUTOMATIC RETRY: Process expired after 20 seconds
    setTimeout(() => {
      this.processExpiredRides().catch((err) =>
        console.error('Auto-retry error:', err),
      );
    }, 20000);

    return {
      success: true,
      message: 'Ride created successfully',
      nearbyDrivers: onlineNearbyDrivers,
      data: ride,
    };
  }

  async acceptRide(rideId: string, driverId: string) {
    const lock = await this.redisService.acquireRideLock(rideId, driverId);

    if (!lock) {
      const lockOwner = await this.redisService.getRideLockOwner(rideId);
      if (lockOwner === driverId) {
        return {
          success: true,
          message: 'Ride already assigned to you',
        };
      }
      throw new ConflictException('Ride already accepted by another driver');
    }

    await Ride.update(
      {
        driver_id: driverId,
        status: 'ASSIGNED',
        assigned_at: new Date(),
      },
      {
        where: {
          id: rideId,
        },
      },
    );

    await RideDriverDetails.update(
      {
        status: 'ACCEPTED',
        responded_at: new Date(),
      },
      {
        where: {
          ride_id: rideId,
          driver_id: driverId,
        },
      },
    );

    await RideDriverDetails.update(
      {
        status: 'EXPIRED',
      },
      {
        where: {
          ride_id: rideId,
          status: 'PENDING',
        },
      },
    );

    return {
      success: true,
      message: 'Ride assigned successfully',
    };
  }

  async processExpiredRides() {
    const expiredOffers = await RideDriverDetails.findAll({
      where: {
        status: 'PENDING',
        expiry_at: {
          [Op.lte]: new Date(),
        },
      },
    });

    const processedRides = new Set<string>();

    for (const offer of expiredOffers) {
      const rideId = offer.getDataValue('ride_id') as string;

      // Prevent processing same ride multiple times
      if (processedRides.has(rideId)) {
        continue;
      }

      processedRides.add(rideId);

      // Expire all pending offers of this ride
      await RideDriverDetails.update(
        {
          status: 'EXPIRED',
        },
        {
          where: {
            ride_id: rideId,
            status: 'PENDING',
          },
        },
      );

      const ride = await Ride.findByPk(rideId);

      if (!ride) {
        continue;
      }

      if (ride.getDataValue('status') !== 'SEARCHING') {
        continue;
      }

      const currentAttempt = Number(ride.getDataValue('search_attempt')) || 0;

      // Maximum 3 retries
      if (currentAttempt >= 3) {
        await Ride.update(
          {
            status: 'TIMEOUT',
          },
          {
            where: {
              id: rideId,
            },
          },
        );
        continue;
      }

      const previousOffers = await RideDriverDetails.findAll({
        where: {
          ride_id: rideId,
        },
      });

      const offeredDriverIds = previousOffers.map(
        (item) => item.getDataValue('driver_id') as string,
      );

      const nearbyDrivers = await this.redisService.findNearbyDrivers(
        Number(ride.getDataValue('pickup_lat')),
        Number(ride.getDataValue('pickup_lng')),
      );

      // Next batch of drivers
      const nextDrivers = nearbyDrivers.filter(
        (driverId) => !offeredDriverIds.includes(driverId),
      );

      const selectedDrivers = nextDrivers.slice(0, 5);

      // No more drivers available
      if (selectedDrivers.length === 0) {
        await Ride.update(
          {
            status: 'TIMEOUT',
          },
          {
            where: {
              id: rideId,
            },
          },
        );
        continue;
      }

      for (const driverId of selectedDrivers) {
        const expiryTime = new Date();
        expiryTime.setSeconds(expiryTime.getSeconds() + 30);

        await RideDriverDetails.create({
          ride_id: rideId,
          driver_id: driverId,
          status: 'PENDING',
          attempt_number: currentAttempt + 1,
          expiry_at: expiryTime,
        });
      }

      await Ride.update(
        {
          search_attempt: currentAttempt + 1,
        },
        {
          where: {
            id: rideId,
          },
        },
      );
    }

    return {
      success: true,
      message: 'Expired rides processed successfully',
    };
  }
}
