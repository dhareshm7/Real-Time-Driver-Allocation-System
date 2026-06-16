import { ConflictException, Injectable } from '@nestjs/common';

import { Customer } from '../models/customer.model';

@Injectable()
export class CustomersService {
  async createCustomer(name: string, phone: string) {
    const existingCustomer = await Customer.findOne({
      where: {
        phone,
      },
    });

    if (existingCustomer) {
      throw new ConflictException('Phone number already exists');
    }

    const customer = await Customer.create({
      name: name.trim(),
      phone: phone.trim(),
    });

    return {
      success: true,
      message: 'Your created successfully',
      data: customer,
    };
  }
}
