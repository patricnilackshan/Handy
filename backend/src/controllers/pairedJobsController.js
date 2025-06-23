const constant = require("../helpers/constants");
const db = require("../helpers/dbHelper");

const createPairedJob = async (req, res) => {
  try {
    const {
      consumer_id,
      provider_id,
      request_id,
      offer_id,
      budget,
      timeframe
    } = req.body;

    if (!consumer_id || !provider_id || !request_id || !offer_id) {
      return res.status(constant.HTTP_STATUS.BAD_REQUEST).json({
        message: "consumer_id, provider_id, request_id, and offer_id are required"
      });
    }

    // Get request details to extract title, description, and service_id
    const request = await db.getOne(
      constant.DB_TABLES.REQUESTS,
      "WHERE request_id = $1",
      [request_id]
    );

    if (!request) {
      return res.status(constant.HTTP_STATUS.NOT_FOUND).json({
        message: "Request not found"
      });
    }

    // Get service_id from the request's service field
    let service_id = 1; // Default service ID
    if (request.service_id) {
      service_id = request.service_id;
    } else if (request.service) {
      // If service is stored as name, find the service_id
      const service = await db.getOne(
        constant.DB_TABLES.SERVICES,
        "WHERE service_name = $1",
        [request.service]
      );
      if (service) {
        service_id = service.service_id;
      }
    }

    // Create the paired job with the correct schema
    const jobData = {
      consumer_id,
      provider_id,
      service_id,
      title: request.title,
      description: request.description,
      cost: budget || request.budget
      // rating and review will be null initially
    };

    // console.log('Creating paired job with data:', jobData);

    const job = await db.create(constant.DB_TABLES.PAIREDJOBS, jobData);

    if (!job) {
      return res.status(constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: "Failed to create paired job"
      });
    }

    const offers = await db.getAll(
      constant.DB_TABLES.OFFERS,
      "WHERE request_id = $1 AND provider_id != $2",
      [request_id, provider_id]
    );

    // // Get all the providers related to the offers and refund platform_tokens
    // const providerIds = offers.map(offer => offer.provider_id);
    // if (providerIds.length > 0) {
    //   const refundPromises = providerIds.map(async (id) => {
    //     const provider = await db.getOne(
    //       constant.DB_TABLES.USERS,
    //       "WHERE user_id = $1",
    //       [id]
    //     );
    //     console.log("Refunding tokens to provider:", provider);
    //     if (provider) {
    //       const updatedTokens = provider.platform_tokens + 1;
    //       await db.update(
    //         constant.DB_TABLES.USERS,
    //         { platform_tokens: updatedTokens },
    //         "WHERE user_id = $1",
    //         [id]
    //       );
    //       // Emit WebSocket notification to each provider
    //       const io = req.app.get("io");
    //       if (io) {
    //         const notificationData = {
    //           job_id: job.job_id,
    //           consumer_id,
    //           request_title: request.title,
    //           message: `Your offer for "${request.title}" has been declined. Platform tokens refunded.`
    //         };
    //         console.log(`Emitting offer decline notification to provider: offer_declined_${id}`, notificationData);
    //         io.emit(`offer_declined_${id}`, notificationData);
    //       }
    //     }
    //   });
    //   await Promise.all(refundPromises);
    // }

    // Emit WebSocket notification to provider
    const io = req.app.get("io");
    if (io) {
      const notificationData = {
        job_id: job.job_id,
        consumer_id,
        request_title: request.title,
        budget: budget || request.budget,
        message: `New job assigned: "${request.title}" - LKR ${budget || request.budget}`
      };

      // console.log(`Emitting new job assignment to provider: new_job_${provider_id}`, notificationData);
      io.emit(`paired_jobs_${provider_id}`, notificationData);
    }
    
    res.status(constant.HTTP_STATUS.CREATED).json({
      success: true,
      job,
      message: "Paired job created successfully"
    });
  } catch (err) {
    console.error("Error creating paired job:", err);
    res.status(constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: "Internal server error",
      details: err.message
    });
  }
};

const getPairedJobs = async (req, res) => {
  const {consumer_id, provider_id} = req.query;
  
  // Helper function to enrich paired jobs with user names
  const enrichPairedJobs = async (jobs) => {
    return await Promise.all(
      jobs.map(async (job) => {
        try {
          // Get consumer details
          const user = await db.getAll(
            constant.DB_TABLES.USERS,
            "WHERE user_id = $1 OR user_id = $2",
            [job.consumer_id, job.provider_id]
          );
          
          return {
            ...job,
            consumer_name: user[0].user_type === "consumer" ? user[0]?.name : user[1]?.name || "Consumer",
            provider_name: user[1].user_type === "provider" ? user[1]?.name : user[0]?.name || "Provider"
          };
        } catch (error) {
          console.error("Error enriching job data:", error);
          return {
            ...job,
            consumer_name: "Consumer",
            provider_name: "Provider"
          };
        }
      })
    );
  };

  if (consumer_id && provider_id) {
    try{
      const conditions = `WHERE consumer_id = $1 and provider_id = $2`;
      const pairedJobList = await db.getAll(constant.DB_TABLES.PAIREDJOBS, conditions, [consumer_id, provider_id]);
      if (pairedJobList && pairedJobList.length > 0) {
        const enrichedJobs = await enrichPairedJobs(pairedJobList);
        res.status(constant.HTTP_STATUS.OK).json(enrichedJobs);
      } else {
        res.status(constant.HTTP_STATUS.NOT_FOUND).json({message: "No paired jobs found"});
      }    
    } catch(err){
      console.error("Error fetching paired jobs (both IDs):", err);
      res.status(constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: "Internal server error"
      });
      throw err;
    } 
  } else if (consumer_id) {
    try{
      const conditions = `WHERE consumer_id = $1`;
      const consumerPairedJobList = await db.getAll(constant.DB_TABLES.PAIREDJOBS, conditions, [consumer_id]);
      if (consumerPairedJobList && consumerPairedJobList.length > 0) {
        const enrichedJobs = await enrichPairedJobs(consumerPairedJobList);
        res.status(constant.HTTP_STATUS.OK).json(enrichedJobs);
      } else {
        res.status(constant.HTTP_STATUS.NOT_FOUND).json({message: `No paired jobs found for consumer ID: ${consumer_id}`});
      }    
    } catch(err){
      console.error("Error fetching paired jobs (consumer):", err);
      res.status(constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: "Internal server error"
      });
      throw err;
    } 
  } else if (provider_id) {
    try{
      const conditions = `WHERE provider_id = $1`;
      const providerPairedJobList = await db.getAll(constant.DB_TABLES.PAIREDJOBS, conditions, [provider_id]);
      if (providerPairedJobList && providerPairedJobList.length > 0) {
        const enrichedJobs = await enrichPairedJobs(providerPairedJobList);
        res.status(constant.HTTP_STATUS.OK).json(enrichedJobs);
        // console.log(`Paired jobs found for provider ID: ${provider_id}`, enrichedJobs);
      } else {
        res.status(constant.HTTP_STATUS.NOT_FOUND).json({message: `No paired jobs found for provider ID: ${provider_id}`});
      }    
    } catch(err){
      console.error("Error fetching paired jobs (provider):", err);
      res.status(constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: "Internal server error"
      });
      throw err;
    } 
  } else {
    res.status(constant.HTTP_STATUS.BAD_REQUEST).json({message: "Either consumer_id or provider_id is required"});
  }
};

const addRatingAndReview = async (req, res) => {
  try {
    const { job_id } = req.params;
    const { rating, review } = req.body;

    // Validate input
    if (!job_id) {
      return res.status(constant.HTTP_STATUS.BAD_REQUEST).json({
        message: "job_id is required"
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(constant.HTTP_STATUS.BAD_REQUEST).json({
        message: "Rating must be between 1 and 5"
      });
    }

    // Check if the paired job exists
    const existingJob = await db.getOne(
      constant.DB_TABLES.PAIREDJOBS,
      "WHERE job_id = $1",
      [job_id]
    );

    if (!existingJob) {
      return res.status(constant.HTTP_STATUS.NOT_FOUND).json({
        message: "Paired job not found"
      });
    }

    // Check if rating already exists
    if (existingJob.rating) {
      return res.status(constant.HTTP_STATUS.BAD_REQUEST).json({
        message: "This job has already been rated"
      });
    }

    // Update the paired job with rating and review
    const updateData = {
      rating: rating,
      review: review || null
    };

    const updatedJob = await db.update(
      constant.DB_TABLES.PAIREDJOBS,
      updateData,
      "WHERE job_id = $1",
      [job_id]
    );

    if (!updatedJob) {
      return res.status(constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: "Failed to update rating and review"
      });
    }

    // Update provider's average rating
    const provider = await db.getOne(
      constant.DB_TABLES.PROVIDERS,
      "WHERE user_id = $1",
      [existingJob.provider_id]
    );

    if (provider) {
      const currentRating = provider.average_rating || 0;
      const currentCount = provider.review_count || 0;
      
      const newTotalRating = (currentRating * currentCount) + rating;
      const newReviewCount = currentCount + 1;
      const newAverageRating = newTotalRating / newReviewCount;

      await db.update(
        constant.DB_TABLES.PROVIDERS,
        {
          average_rating: newAverageRating,
          review_count: newReviewCount
        },
        "WHERE user_id = $1",
        [existingJob.provider_id]
      );
    }

    // Emit WebSocket notification to provider
    const io = req.app.get("io");
    if (io) {
      const notificationData = {
        job_id: job_id,
        consumer_id: existingJob.consumer_id,
        rating: rating,
        review: review,
        message: `New ${rating}-star rating received for "${existingJob.title}"`
      };

      // console.log(`Emitting rating notification to provider: new_rating_${existingJob.provider_id}`, notificationData);
      io.emit(`new_rating_${existingJob.provider_id}`, notificationData);
    }

    res.status(constant.HTTP_STATUS.OK).json({
      success: true,
      message: "Rating and review submitted successfully",
      job: updatedJob
    });

  } catch (err) {
    console.error("Error adding rating and review:", err);
    res.status(constant.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: "Internal server error",
      details: err.message
    });
  }
};

module.exports = {
    createPairedJob,
    getPairedJobs,
    addRatingAndReview
};
