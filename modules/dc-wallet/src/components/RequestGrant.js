import { Button, Grid, withStyles, TextField } from "@material-ui/core";
import React from "react";

import "../App.css";

const styles = {};

class RequestGrant extends React.Component {

  handleSubmit = (e) => {
    e.preventDefault();
    const {ethAddress, associatedAddress} = this.props;
    console.log('have ethaddress: ', ethAddress);
    const options = {
      method: 'GET',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    // Send
    fetch('https://adbot.gazecoin.xyz/requestgrant/' + ethAddress + '/P', options);


    if (associatedAddress) {
      fetch('https://adbot.gazecoin.xyz/requestgrant/' + associatedAddress + '/N', options);
    }
  }

  render() {
    //const { address } = this.props;
    //const { store, channel } = this.state;
    return (
      <>
        <Grid
          container
          spacing={20}
          direction="column"
          style={{ paddingLeft: "2%", paddingRight: "2%", textAlign: "center" }}
        >
          <Grid item xs={12}>
            <TextField
              id="standard-multiline-flexible"
              value="Claim your free credits here"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              style={{ marginBottom: "5%" }}
              fullWidth
              color="primary"
              variant="outlined"
              onClick={this.handleSubmit}
            >
              Request Credits
            </Button>
          </Grid>
        </Grid>
      </>
    );
  }
}

export default withStyles(styles)(RequestGrant);
