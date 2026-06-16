import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database/database';

export class Ride extends Model {
  id: any;
}

Ride.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    customer_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    driver_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'drivers',
        key: 'id',
      },
    },

    pickup_lat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },

    pickup_lng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },

    drop_lat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },

    drop_lng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        'REQUESTED',
        'SEARCHING',
        'ASSIGNED',
        'TIMEOUT',
        'COMPLETED',
        'CANCELLED',
      ),
      allowNull: false,
      defaultValue: 'REQUESTED',
    },

    search_attempt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    requested_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    assigned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rides',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
