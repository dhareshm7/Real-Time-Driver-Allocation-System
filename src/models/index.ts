import { Customer } from './customer.model';
import { Driver } from './driver.model';
import { Ride } from './ride.model';
import { RideDriverDetails } from './ride_driver_details.model';

// Associations
Customer.hasMany(Ride, {
  foreignKey: 'customer_id',
  as: 'rides',
});

Ride.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'customer',
});

Driver.hasMany(Ride, {
  foreignKey: 'driver_id',
  as: 'assignedRides',
});

Ride.belongsTo(Driver, {
  foreignKey: 'driver_id',
  as: 'assignedDriver',
});

Ride.hasMany(RideDriverDetails, {
  foreignKey: 'ride_id',
  as: 'offers',
});

RideDriverDetails.belongsTo(Ride, {
  foreignKey: 'ride_id',
  as: 'ride',
});

Driver.hasMany(RideDriverDetails, {
  foreignKey: 'driver_id',
  as: 'offers',
});

RideDriverDetails.belongsTo(Driver, {
  foreignKey: 'driver_id',
  as: 'driver',
});

export { Customer, Driver, Ride, RideDriverDetails };
