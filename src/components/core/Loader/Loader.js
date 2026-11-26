import React, {PureComponent} from "react"
import {ClipLoader, BeatLoader} from "react-spinners";

export default class Loader extends PureComponent {
  render() {
    // `label` announces the spinner to screen readers; without it the
    // spinner is decorative (its meaning is carried by adjacent text).
    const {label, ...spinnerProps} = this.props;
    const a11yProps = label
      ? {role: "status", "aria-label": label}
      : {"aria-hidden": "true"};
    return (
      <span className="loader" {...a11yProps}>
        <ClipLoader size={15} color={this.props.color || "#fff"} {...spinnerProps}/>
      </span>
    )
  }
}

export class TypingLoader extends PureComponent {
  render() {
    return (
      <BeatLoader size={5} {...this.props} />
    )
  }
}
