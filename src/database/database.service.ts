import { Injectable, OnModuleInit } from '@nestjs/common';
import { sequelize } from './database';
import '../models';

@Injectable()
export class DatabaseService implements OnModuleInit {
  async onModuleInit() {
    try {
      await sequelize.authenticate();
      console.log('DB Connected');
      await sequelize.sync();
    } catch (error) {
      console.error('DB Connection Failed');
      console.error(error);
    }
  }
}
