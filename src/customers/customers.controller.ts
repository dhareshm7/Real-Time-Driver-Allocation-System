import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { CustomersService } from './customers.service';

interface CreateCustomerBody {
  name: string;
  phone: string;
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  createCustomer(@Body() body: CreateCustomerBody) {
    const { name, phone } = body;

    if (!name || !phone) {
      throw new BadRequestException('All fields are required');
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      throw new BadRequestException('Phone number must be exactly 10 digits');
    }

    return this.customersService.createCustomer(name, phone);
  }
}
