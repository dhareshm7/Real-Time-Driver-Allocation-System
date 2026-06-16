import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../database/database';

export class RideDriverDetails extends Model {}

RideDriverDetails.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    ride_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    driver_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },

    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    offered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    expiry_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'ride_driver_details',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
