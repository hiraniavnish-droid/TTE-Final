import React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import "react-day-picker/style.css";
export default function CalendarPicker(props: DayPickerProps) {
  return <DayPicker {...props} />;
}
