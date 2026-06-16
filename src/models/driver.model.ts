// src/models/driver.model.ts

import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/database';

export class Driver extends Model {
  vehicle_number: string | undefined;
  phone: string | undefined;
  status: string | undefined;
}

Driver.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    phone: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
    },

    vehicle_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },

    status: {
      type: DataTypes.ENUM('ONLINE', 'OFFLINE', 'BUSY'),
      defaultValue: 'OFFLINE',
    },
  },
  {
    sequelize,
    tableName: 'drivers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
