Open source client-side menstrual tracker with ML predictions and zero data collection.

**TODO**

- [x] track periods, ovulation and related symptoms
- [x] ml model for cycle len prediction
- [x] adding numbered days to tracked cycles
- [x] export/import user data
- [ ] further opts sexual activity, exercise, medication, miscarriage/abortion
- [ ] ml model ovulation day prediction
- [ ] tidy jupyter and writeup

## Features

- Client-side React only: Data stored in IndexedDB. Never leaves your device.

- ML predictions: XGBoost model (ONNX Runtime) achieves 1.99 day RMSE using just last 2 cycles.

- Full tracking: Periods, ovulation, symptoms, numbered cycle days.


