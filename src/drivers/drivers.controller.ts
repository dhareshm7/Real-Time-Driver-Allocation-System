import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { DriversService } from './drivers.service';

interface CreateDriverBody {
  name: string;
  phone: string;
  vehicleNumber: string;
}

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  async createDriver(@Body() body: CreateDriverBody, @Res() res: Response) {
    const { name, phone, vehicleNumber } = body;

    if (!name || !phone || !vehicleNumber) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Phone number must be exactly 10 digits',
      });
    }

    if (
      !/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/.test(vehicleNumber.toUpperCase())
    ) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Vehicle number must be in format KA01AB1234',
      });
    }

    const result = await this.driversService.createDriver(
      name,
      phone,
      vehicleNumber,
    );

    return res.status(HttpStatus.CREATED).json(result);
  }

  @Post(':id/location')
  async updateLocation(
    @Param('id') driverId: string,
    @Body()
    body: {
      latitude: number;
      longitude: number;
    },
  ) {
    const { latitude, longitude } = body;

    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestException('Latitude and longitude are required');
    }

    return await this.driversService.updateLocation(
      driverId,
      latitude,
      longitude,
    );
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') driverId: string,
    @Body() body: { status: string },
  ) {
    const { status } = body;

    if (!['ONLINE', 'OFFLINE', 'BUSY'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return await this.driversService.updateStatus(driverId, status);
  }
}
