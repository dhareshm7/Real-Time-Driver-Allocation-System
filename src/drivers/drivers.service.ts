import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Op } from 'sequelize';

import { Driver } from '../models/driver.model';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DriversService {
  constructor(private readonly redisService: RedisService) {}

  async createDriver(name: string, phone: string, vehicleNumber: string) {
    const existingDriver = await Driver.findOne({
      where: {
        [Op.or]: [{ phone }, { vehicle_number: vehicleNumber }],
      },
    });

    if (existingDriver) {
      if (existingDriver.phone === phone) {
        throw new ConflictException('Phone number already exists');
      }

      if (existingDriver.vehicle_number === vehicleNumber) {
        throw new ConflictException('Vehicle number already exists');
      }
    }

    const driver = await Driver.create({
      name: name,
      phone: phone.trim(),
      vehicleNumber: vehicleNumber.toUpperCase().trim(),
      status: 'OFFLINE',
    });

    return {
      success: true,
      message: 'Driver created successfully',
      data: driver,
    };
  }

  async updateLocation(driverId: string, latitude: number, longitude: number) {
    await this.redisService.updateDriverLocation(driverId, latitude, longitude);

    return {
      success: true,
      message: 'Driver location updated successfully',
    };
  }

  async updateStatus(driverId: string, status: string) {
    const driver = await Driver.findByPk(driverId);

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    await Driver.update(
      { status },
      {
        where: {
          id: driverId,
        },
      },
    );

    if (status === 'ONLINE') {
      await this.redisService.markDriverOnline(driverId);
    } else {
      await this.redisService.markDriverOffline(driverId);
    }

    return {
      success: true,
      message: `Driver marked ${status}`,
    };
  }
}
