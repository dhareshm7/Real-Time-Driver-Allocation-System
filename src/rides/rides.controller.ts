import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';
import { RidesService } from './rides.service';

interface CreateRideBody {
  customerId: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  createRide(@Body() body: CreateRideBody) {
    const { customerId, pickupLat, pickupLng, dropLat, dropLng } = body;

    if (
      !customerId ||
      pickupLat === undefined ||
      pickupLng === undefined ||
      dropLat === undefined ||
      dropLng === undefined
    ) {
      throw new BadRequestException('All fields are required');
    }

    return this.ridesService.createRide(
      customerId,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    );
  }

  @Post('process-expired')
  async processExpiredRides() {
    return this.ridesService.processExpiredRides();
  }

  @Post(':rideId/accept')
  async acceptRide(
    @Param('rideId') rideId: string,
    @Body() body: { driverId: string },
  ) {
    return this.ridesService.acceptRide(rideId, body.driverId);
  }
}
