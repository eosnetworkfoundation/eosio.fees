# EOS Fees (`eosio.fees`) [![Bun Test](https://github.com/eosnetworkfoundation/eosio.fees/actions/workflows/test.yml/badge.svg)](https://github.com/eosnetworkfoundation/eosio.fees/actions/workflows/test.yml)

## Overview

The `eosio.fees` contract handles system fee distribution.

## Development and Testing

### Build Instructions

To compile the contract, developers can use the following command:

```sh
$ cdt-cpp eosio.fees.cpp -I ./include
```

### Testing Framework

The contract includes a comprehensive testing suite designed to validate its functionality. The tests are executed using the following commands:

```sh
$ npm test

> test
> bun test
```