import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseService } from './database/database.service';
import { RedisModule } from './redis/redis.module';
import { DriversModule } from './drivers/drivers.module';
import { RidesModule } from './rides/rides.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    DriversModule,
    RidesModule,
    CustomersModule,
  ],
  providers: [DatabaseService],
})
export class AppModule {}
