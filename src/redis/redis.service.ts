import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  onModuleInit() {
    this.redis.on('connect', () => {
      this.logger.log('Redis Connected Successfully');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis Connection Error:', err.message);
    });
  }

  getClient(): Redis {
    return this.redis;
  }

  async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number,
  ) {
    await this.redis.geoadd('drivers:locations', longitude, latitude, driverId);
  }

  async markDriverOnline(driverId: string) {
    await this.redis.sadd('driver:available', driverId);
  }

  async markDriverOffline(driverId: string) {
    await this.redis.srem('driver:available', driverId);
  }

  async findNearbyDrivers(latitude: number, longitude: number) {
    const nearbyDrivers = (await this.redis.geosearch(
      'drivers:locations',
      'FROMLONLAT',
      longitude,
      latitude,
      'BYRADIUS',
      5,
      'km',
    )) as string[];

    const availableDrivers = await this.redis.smembers('driver:available');

    return nearbyDrivers.filter((driverId) =>
      availableDrivers.includes(driverId),
    );
  }

  async acquireRideLock(rideId: string, driverId: string) {
    return this.redis.set(`ride:lock:${rideId}`, driverId, 'EX', 30, 'NX');
  }

  async getRideLockOwner(rideId: string) {
    return this.redis.get(`ride:lock:${rideId}`);
  }
}
