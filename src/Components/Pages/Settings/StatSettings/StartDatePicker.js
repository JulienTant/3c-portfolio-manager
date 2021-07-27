import { getTime } from 'date-fns'
import React, { useContext, useState, useEffect, forwardRef }from 'react';
import DateFnsUtils from '@date-io/date-fns';

import dotProp from 'dot-prop';

import {
  MuiPickersUtilsProvider,
  KeyboardDatePicker,
} from '@material-ui/pickers';

import { useGlobalState } from '../../../../Context/Config';
const startDatePath = 'statSettings.startDate'
// finding the data that exists based on the dotprop.
const findData = (config, path) => {
  console.log('running find data')
  console.log({ config, path })
  if (dotProp.has(config, path)) return dotProp.get(config, path)
  return ""
}


export default function StartDatePicker(props) {
  const state = useGlobalState()
    const {  state: {date, updateDate} } = state

  // const [selectedDate, setSelectedDate] = useState(() => new Date());

//   useEffect(() =>{
//     setSelectedDate( findData(config, startDatePath));
// }, [config])

  const handleDateChange = (date) => {
    updateDate(getTime(date));
    
    console.log('changing the date')
  };

  return (
    <MuiPickersUtilsProvider utils={DateFnsUtils} >
        <KeyboardDatePicker
          disableToolbar
          variant="inline"
          format="MM/dd/yyyy"
          margin="normal"
          id="date-picker-inline"
          label="Stats Start Date"
          value={date}
          onChange={handleDateChange}
          KeyboardButtonProps={{
            'aria-label': 'change date',
          }}
        />
    </MuiPickersUtilsProvider>
  );
}