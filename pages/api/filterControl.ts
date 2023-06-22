import { NextApiRequest, NextApiResponse } from "next";

let filterEnabled = false;

export default function handler(req : NextApiRequest, res : NextApiResponse) {
  if (req.method === 'POST') {
    filterEnabled = req.body.checkedFilterOption;
    res.status(200).json({ message: `Boolean value ${filterEnabled} stored successfully.` });
  } else if (req.method === 'GET') {
    res.status(200).json({ filterEnabled });
  }
}
